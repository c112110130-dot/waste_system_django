"""
Optimized visualization data service for the medical waste management system.

This service provides optimized database queries and data processing for the visualization module,
addressing performance bottlenecks while maintaining API compatibility.
"""

from django.db.models import Sum, Avg, Q
from django.core.cache import cache
from django.utils import timezone
from datetime import datetime
import hashlib
import json
import logging

logger = logging.getLogger(__name__)


class VisualizeDataService:
    """Optimized data service for visualization requests."""
    
    # Cache timeout for date range calculations (1 hour)
    CACHE_TIMEOUT = 3600
    
    @staticmethod
    def get_optimized_data(model_class, field_info, y_axis, start_date, end_date, 
                          x_axis, selected_field, only_month_context=None):
        """
        Optimized data retrieval with database-level aggregation.
        
        Args:
            model_class: Django model class
            field_info: Field information dictionary
            y_axis: Y-axis unit type
            start_date: Start date string (YYYY-MM)
            end_date: End date string (YYYY-MM)
            x_axis: X-axis aggregation type
            selected_field: Field to aggregate
            only_month_context: Month context for label alignment
            
        Returns:
            Dictionary containing optimized data, raw_data, and labels
        """
        try:
            # Validate field exists and is supported
            if selected_field not in field_info:
                logger.warning(f"Field {selected_field} not found in field_info")
                return {'data': [], 'raw_data': [], 'labels': []}
            
            field_unit = field_info[selected_field]['unit']
            if field_unit not in ['metric_ton', 'kilogram', 'new_taiwan_dollar']:
                logger.warning(f"Unsupported field unit: {field_unit}")
                return {'data': [], 'raw_data': [], 'labels': []}
            
            # Get target unit from y_axis
            y_axis_unit = VisualizeDataService._get_unit_from_y_axis(y_axis)
            
            # Generate cache key for this request
            cache_key = VisualizeDataService._generate_cache_key(
                model_class.__name__, selected_field, start_date, end_date, x_axis, y_axis
            )
            
            # Try to get from cache first
            cached_result = cache.get(cache_key)
            if cached_result:
                return cached_result
            
            # Prepare date range filter
            start_date_formatted = start_date[:7]
            end_date_formatted = end_date[:7]
            
            # Build base queryset with optimizations
            queryset = model_class.objects.filter(
                date__gte=start_date_formatted,
                date__lte=end_date_formatted
            ).exclude(
                Q(**{selected_field + '__isnull': True}) | Q(**{selected_field: 0})
            )
            
            # Check if we have any records at all
            total_records = queryset.count()
            if total_records == 0:
                logger.warning(f"No records found for {model_class.__name__}.{selected_field} in date range {start_date_formatted} to {end_date_formatted}")
                return {'data': [], 'raw_data': [], 'labels': []}
            
            # Apply database-level aggregation based on x_axis type
            aggregated_data = VisualizeDataService._apply_aggregation(
                queryset, selected_field, x_axis
            )
            
            # Generate time labels efficiently
            if x_axis == 'only_month' and only_month_context and only_month_context.get('global_labels'):
                time_labels = only_month_context['global_labels']
            else:
                time_labels = VisualizeDataService._generate_time_labels(
                    start_date_formatted, end_date_formatted, x_axis
                )
            
            # Process aggregated data into final format
            result = VisualizeDataService._process_aggregated_data(
                aggregated_data, time_labels, field_unit, y_axis_unit, x_axis
            )
            
            # Cache the result
            cache.set(cache_key, result, VisualizeDataService.CACHE_TIMEOUT)
            
            return result
            
        except Exception as e:
            logger.error(f"Error in get_optimized_data for {model_class.__name__}.{selected_field}: {str(e)}", exc_info=True)
            return {'data': [], 'raw_data': [], 'labels': []}
    
    @staticmethod
    def _apply_aggregation(queryset, selected_field, x_axis):
        """Apply database-level aggregation based on x_axis type."""
        x_axis_base = x_axis.split('_')[0] if '_' in x_axis else x_axis
        
        # Determine aggregation function
        if x_axis.endswith('_avg'):
            agg_func = Avg(selected_field)
        else:
            agg_func = Sum(selected_field)
        
        # Apply appropriate grouping and aggregation
        # Note: date field is stored as string 'YYYY-MM', so use substr() instead of strftime()
        if x_axis_base == 'year':
            return queryset.extra(
                select={'period': "substr(date, 1, 4)"}  # Extract year from 'YYYY-MM'
            ).values('period').annotate(
                value=agg_func,
                raw_value=agg_func  # For raw data tracking
            ).order_by('period')
            
        elif x_axis_base == 'quarter':
            return queryset.extra(
                select={
                    'period': "substr(date, 1, 4) || '-' || "
                             "CASE WHEN CAST(substr(date, 6, 2) AS INTEGER) <= 3 THEN 'Q1' "
                             "WHEN CAST(substr(date, 6, 2) AS INTEGER) <= 6 THEN 'Q2' "
                             "WHEN CAST(substr(date, 6, 2) AS INTEGER) <= 9 THEN 'Q3' "
                             "ELSE 'Q4' END"
                }
            ).values('period').annotate(
                value=agg_func,
                raw_value=agg_func
            ).order_by('period')
            
        elif x_axis_base == 'month':
            return queryset.extra(
                select={'period': "date"}  # Date is already in 'YYYY-MM' format
            ).values('period').annotate(
                value=agg_func,
                raw_value=agg_func
            ).order_by('period')
            
        else:  # only_month
            return queryset.extra(
                select={'period': "substr(date, 6, 2)"}  # Extract month from 'YYYY-MM'
            ).values('period').annotate(
                value=agg_func,
                raw_value=agg_func
            ).order_by('period')
    
    @staticmethod
    def _process_aggregated_data(aggregated_data, time_labels, field_unit, y_axis_unit, x_axis):
        """Process aggregated data into final format with unit conversion."""
        # Create lookup dictionary from aggregated data
        data_lookup = {}
        raw_data_lookup = {}
        
        for item in aggregated_data:
            period = item['period']
            value = item['value'] or 0
            raw_value = item['raw_value'] or 0
            
            # Apply unit conversion
            converted_value = VisualizeDataService._standardize_value(
                field_unit, value, y_axis_unit
            )
            
            data_lookup[period] = converted_value
            raw_data_lookup[period] = raw_value
        
        # Map data to time labels
        series_data = []
        raw_series_data = []
        
        for label in time_labels:
            data_value = data_lookup.get(label, 0)
            raw_value = raw_data_lookup.get(label, 0)
            
            series_data.append(round(data_value, 2))
            raw_series_data.append(round(raw_value, 2))
        
        return {
            'data': series_data,
            'raw_data': raw_series_data,
            'labels': time_labels
        }
    
    @staticmethod
    def _generate_time_labels(start_date, end_date, x_axis):
        """Generate time labels efficiently with caching."""
        cache_key = f"time_labels_{start_date}_{end_date}_{x_axis}"
        cached_labels = cache.get(cache_key)
        
        if cached_labels:
            return cached_labels
        
        # Use the existing generate_date_range function but with caching
        from .views import generate_date_range
        labels = generate_date_range(start_date, end_date, x_axis)
        
        # Cache for 1 hour
        cache.set(cache_key, labels, 3600)
        return labels
    
    @staticmethod
    def _standardize_value(field_unit, value, target_unit):
        """Convert values between different units efficiently."""
        if field_unit == target_unit:
            return value
        
        # Conversion matrix for efficiency
        conversions = {
            ('kilogram', 'metric_ton'): lambda x: x / 1000.0,
            ('metric_ton', 'kilogram'): lambda x: x * 1000.0,
        }
        
        conversion_key = (field_unit, target_unit)
        if conversion_key in conversions:
            return conversions[conversion_key](value)
        
        return value
    
    @staticmethod
    def _get_unit_from_y_axis(y_axis):
        """Extract unit from y_axis parameter."""
        if y_axis in ['metric_ton', 'metric_ton_percentage', 'weight_percentage_metric_ton']:
            return 'metric_ton'
        elif y_axis in ['kilogram', 'kilogram_percentage', 'weight_percentage', 'weight_percentage_kilogram']:
            return 'kilogram'
        elif y_axis in ['new_taiwan_dollar', 'new_taiwan_dollar_percentage', 'cost_percentage_new_taiwan_dollar']:
            return 'new_taiwan_dollar'
        return 'metric_ton'  # Default fallback
    
    @staticmethod
    def _generate_cache_key(*args):
        """Generate a consistent cache key from arguments."""
        key_data = json.dumps(args, sort_keys=True)
        return f"visualize_data_{hashlib.md5(key_data.encode()).hexdigest()}"


class VisualizeRequestValidator:
    """Comprehensive validation for visualization requests."""
    
    VALID_CHART_TYPES = ['bar', 'line', 'area', 'pie', 'donut', 'stackedBar', 'stacked_bar']
    VALID_Y_AXIS_UNITS = [
        'metric_ton', 'kilogram', 'new_taiwan_dollar',
        'metric_ton_percentage', 'kilogram_percentage', 'new_taiwan_dollar_percentage',
        'weight_percentage_metric_ton', 'weight_percentage_kilogram', 'weight_percentage',
        'cost_percentage_new_taiwan_dollar'
    ]
    VALID_X_AXIS_TYPES = [
        'year', 'year_sum', 'year_avg',
        'quarter', 'quarter_sum', 'quarter_avg',
        'month', 'only_month'
    ]
    
    @staticmethod
    def validate_chart_request(data):
        """
        Validate chart request data comprehensively.
        
        Args:
            data: Request data dictionary
            
        Returns:
            Tuple of (is_valid, error_message, cleaned_data)
        """
        try:
            # Extract required fields
            chart_type = data.get('chart_type')
            y_axis = data.get('y_axis')
            x_axis = data.get('x_axis')
            datasets = data.get('datasets', [])
            
            # Validate required fields
            if not all([chart_type, y_axis, x_axis, datasets]):
                return False, "Missing required fields: chart_type, y_axis, x_axis, or datasets", None
            
            # Validate chart_type
            if chart_type not in VisualizeRequestValidator.VALID_CHART_TYPES:
                return False, f"Invalid chart_type: {chart_type}. Must be one of {VisualizeRequestValidator.VALID_CHART_TYPES}", None
            
            # Validate y_axis
            if y_axis not in VisualizeRequestValidator.VALID_Y_AXIS_UNITS:
                return False, f"Invalid y_axis: {y_axis}. Must be one of {VisualizeRequestValidator.VALID_Y_AXIS_UNITS}", None
            
            # Validate x_axis
            if x_axis not in VisualizeRequestValidator.VALID_X_AXIS_TYPES:
                return False, f"Invalid x_axis: {x_axis}. Must be one of {VisualizeRequestValidator.VALID_X_AXIS_TYPES}", None
            
            # Validate datasets
            if not isinstance(datasets, list) or len(datasets) == 0:
                return False, "datasets must be a non-empty list", None
            
            cleaned_datasets = []
            for i, dataset in enumerate(datasets):
                is_valid, error_msg, cleaned_dataset = VisualizeRequestValidator._validate_dataset(dataset, i)
                if not is_valid:
                    return False, error_msg, None
                cleaned_datasets.append(cleaned_dataset)
            
            # Create cleaned data
            cleaned_data = {
                'chart_type': chart_type,
                'y_axis': y_axis,
                'x_axis': x_axis,
                'datasets': cleaned_datasets,
                'title': data.get('title', ''),
                'show_values': bool(data.get('show_values', False))
            }
            
            return True, None, cleaned_data
            
        except Exception as e:
            logger.error(f"Validation error: {str(e)}", exc_info=True)
            return False, f"Validation error: {str(e)}", None
    
    @staticmethod
    def _validate_dataset(dataset, index):
        """Validate individual dataset."""
        required_fields = ['table', 'field', 'start_date', 'end_date']
        
        # Check required fields
        for field in required_fields:
            if field not in dataset:
                return False, f"Dataset {index}: Missing required field '{field}'", None
        
        # Validate date formats
        start_date = dataset['start_date']
        end_date = dataset['end_date']
        
        if not VisualizeRequestValidator._validate_date_format(start_date):
            return False, f"Dataset {index}: Invalid start_date format. Expected YYYY-MM", None
        
        if not VisualizeRequestValidator._validate_date_format(end_date):
            return False, f"Dataset {index}: Invalid end_date format. Expected YYYY-MM", None
        
        # Validate date range
        if start_date > end_date:
            return False, f"Dataset {index}: start_date cannot be later than end_date", None
        
        # Clean and validate other fields
        cleaned_dataset = {
            'table': str(dataset['table']).strip(),
            'field': str(dataset['field']).strip(),
            'start_date': start_date,
            'end_date': end_date,
            'name': str(dataset.get('name', '')).strip(),
            'color': VisualizeRequestValidator._validate_color(dataset.get('color', '#000000'))
        }
        
        return True, None, cleaned_dataset
    
    @staticmethod
    def _validate_date_format(date_str):
        """Validate date format (YYYY-MM)."""
        if not isinstance(date_str, str) or len(date_str) < 7:
            return False
        
        try:
            # Try to parse the date
            datetime.strptime(date_str[:7], '%Y-%m')
            return True
        except ValueError:
            return False
    
    @staticmethod
    def _validate_color(color_str):
        """Validate and clean color string."""
        if not isinstance(color_str, str):
            return '#000000'
        
        color_str = color_str.strip()
        
        # Ensure it starts with #
        if not color_str.startswith('#'):
            color_str = '#' + color_str
        
        # Ensure it's the right length
        if len(color_str) == 7 and all(c in '0123456789abcdefABCDEF' for c in color_str[1:]):
            return color_str
        
        return '#000000'  # Default fallback


class VisualizeCacheManager:
    """Centralized cache management for visualization data."""
    
    CACHE_PREFIX = 'visualize_'
    DEFAULT_TIMEOUT = 3600  # 1 hour
    
    @staticmethod
    def get_cached_data(cache_key):
        """Get cached data with prefix."""
        full_key = VisualizeCacheManager.CACHE_PREFIX + cache_key
        return cache.get(full_key)
    
    @staticmethod
    def set_cached_data(cache_key, data, timeout=None):
        """Set cached data with prefix."""
        full_key = VisualizeCacheManager.CACHE_PREFIX + cache_key
        timeout = timeout or VisualizeCacheManager.DEFAULT_TIMEOUT
        cache.set(full_key, data, timeout)
    
    @staticmethod
    def delete_cached_data(cache_key):
        """Delete cached data."""
        full_key = VisualizeCacheManager.CACHE_PREFIX + cache_key
        cache.delete(full_key)
    
    @staticmethod
    def clear_all_cache():
        """Clear all visualization cache data."""
        # This implementation depends on the cache backend
        # For Redis: could use pattern deletion
        # For now, we'll rely on cache expiration
        pass