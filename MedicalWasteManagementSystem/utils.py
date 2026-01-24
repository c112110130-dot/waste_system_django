"""
Shared utilities for Medical Waste Management System
Consolidates common functionality to reduce code duplication
"""
import json
import logging
import re
from datetime import datetime
from typing import Optional, Dict, Any, List
from django.http import JsonResponse
from django.db import transaction
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)


# =============================================================
# Date and Time Utilities
# =============================================================

def validate_date_format(date_str: str, date_format: str = "%Y-%m") -> bool:
    """
    Validate date string format
    Consolidated from duplicate functions in WasteManagement and WastePrediction
    """
    if not date_str:
        return False
    
    try:
        datetime.strptime(date_str, date_format)
        return True
    except ValueError:
        return False


def parse_date_with_fallback(date_str: str, fallback_format: str = "%Y-%m-%d") -> Optional[datetime]:
    """Parse date with multiple format attempts"""
    if not date_str:
        return None
    
    formats = ["%Y-%m-%d", "%Y/%m/%d", "%Y-%m", fallback_format]
    
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    
    logger.warning(f"Failed to parse date string: {date_str}")
    return None


# =============================================================
# Response Utilities
# =============================================================

def create_error_response(error_message: str, status_code: int = 400, 
                         error_type: str = "validation_error") -> JsonResponse:
    """
    Create standardized error response
    Consolidates duplicate error response patterns
    """
    return JsonResponse({
        'success': False,
        'error': error_message,
        'error_type': error_type
    }, status=status_code)


def create_success_response(data: Dict[str, Any] = None, message: str = "操作成功") -> JsonResponse:
    """Create standardized success response"""
    response_data = {
        'success': True,
        'message': message
    }
    if data:
        response_data.update(data)
    return JsonResponse(response_data)


def handle_json_decode_error(request_body: str) -> Optional[Dict]:
    """
    Safe JSON decoding with consistent error handling
    Returns None if decode fails, logs error
    """
    try:
        return json.loads(request_body)
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error during JSON decode: {str(e)}")
        return None


# =============================================================
# Database Utilities
# =============================================================

class BatchProcessor:
    """
    Consolidated batch processing functionality
    Replaces duplicate batch processing logic across apps
    """
    
    def __init__(self, batch_size: int = 15):
        self.batch_size = batch_size
    
    @transaction.atomic
    def process_batch_create(self, model_class, rows_to_create, 
                           update_conflicts: bool = False) -> int:
        """
        Process batch creation with optimized performance
        Handles both List[Dict] and List[Tuple[int, Dict]] formats for backward compatibility
        """
        success_count = 0
        
        try:
            if not rows_to_create:
                return 0
            
            # Convert tuple format (idx, row) to dict format if needed
            if isinstance(rows_to_create[0], tuple):
                processed_rows = []
                fields = [f.name for f in model_class._meta.fields if f.name not in ['id', 'date']]
                
                for idx, row in rows_to_create:
                    obj_data = {'date': row.get('date')}
                    for field in fields:
                        value = row.get(field)
                        if value and str(value).strip():
                            try:
                                field_obj = model_class._meta.get_field(field)
                                if hasattr(field_obj, 'get_internal_type'):
                                    if field_obj.get_internal_type() == 'FloatField':
                                        obj_data[field] = float(str(value).strip())
                                    elif field_obj.get_internal_type() in ['IntegerField', 'BigIntegerField']:
                                        obj_data[field] = int(str(value).strip())
                                    else:
                                        obj_data[field] = str(value).strip()
                            except (ValueError, TypeError):
                                obj_data[field] = None
                        else:
                            obj_data[field] = None
                    processed_rows.append(obj_data)
                
                rows_to_create = processed_rows
            
            # Use bulk_create for better performance
            objects_to_create = [model_class(**row) for row in rows_to_create]
            if update_conflicts:
                update_fields = [key for key in rows_to_create[0].keys() if key != 'date'] if rows_to_create else []
                created_objects = model_class.objects.bulk_create(
                    objects_to_create,
                    batch_size=self.batch_size,
                    update_conflicts=True,
                    unique_fields=['date'],
                    update_fields=update_fields
                )
            else:
                created_objects = model_class.objects.bulk_create(
                    objects_to_create,
                    batch_size=self.batch_size,
                    ignore_conflicts=True
                )
            success_count = len(created_objects)
                
        except Exception as e:
            logger.error(f"Batch create error: {str(e)}", exc_info=True)
            success_count = 0
        
        return success_count
    
    @transaction.atomic
    def process_batch_update(self, model_class, update_data: List[Dict], 
                           id_field: str = 'id') -> Dict[str, int]:
        """Process batch updates efficiently"""
        success_count = 0
        error_count = 0
        
        try:
            # Extract IDs and create update objects
            objects_to_update = []
            for data in update_data:
                obj_id = data.pop(id_field)
                obj = model_class(id=obj_id, **data)
                objects_to_update.append(obj)
            
            # Bulk update
            model_class.objects.bulk_update(
                objects_to_update,
                fields=list(update_data[0].keys()) if update_data else [],
                batch_size=self.batch_size
            )
            success_count = len(objects_to_update)
            
        except Exception as e:
            logger.error(f"Batch update error: {str(e)}")
            error_count = len(update_data)
        
        return {
            'success_count': success_count,
            'error_count': error_count,
            'total_processed': len(update_data)
        }


# =============================================================
# Validation Utilities
# =============================================================

def validate_required_fields(data: Dict[str, Any], required_fields: List[str]) -> List[str]:
    """
    Validate that required fields are present and non-empty
    Returns list of missing field names
    """
    missing_fields = []
    
    for field in required_fields:
        value = data.get(field)
        if value is None or (isinstance(value, str) and not value.strip()):
            missing_fields.append(field)
    
    return missing_fields


def sanitize_string(input_str: str, max_length: int = 255) -> str:
    """
    Sanitize string input for security
    Removes potentially dangerous characters and limits length
    """
    if not isinstance(input_str, str):
        return str(input_str)[:max_length]
    
    # Remove potentially dangerous characters
    dangerous_patterns = [
        r'<script.*?>.*?</script>',
        r'javascript:',
        r'on\w+\s*=',
        r'<iframe.*?>.*?</iframe>',
        r'<object.*?>.*?</object>',
        r'<embed.*?>.*?</embed>'
    ]
    
    sanitized = input_str
    for pattern in dangerous_patterns:
        sanitized = re.sub(pattern, '', sanitized, flags=re.IGNORECASE | re.DOTALL)
    
    return sanitized.strip()[:max_length]


# =============================================================
# Query Optimization Utilities
# =============================================================

class QueryOptimizer:
    """
    Utilities for optimizing database queries
    """
    
    @staticmethod
    def optimize_manifest_queryset(queryset):
        """
        Optimize manifest queryset with proper select_related
        Fixes N+1 query problems in WasteTransportation
        """
        return queryset.select_related(
            'declaration__enterprise',
            'waste_substance_id__waste_substance_code',
            'waste_substance_id__process',
            'transportation__transporter',
            'transportation__transport_vehicle__transporter',
            'treatment__treatment_facility',
            'recovery__recycler'
        ).prefetch_related(
            'transportation__transporter',
            'treatment__treatment_facility',
            'recovery__recycler'
        )
    
    @staticmethod
    def optimize_waste_production_queryset(queryset):
        """
        Optimize waste production queries for dashboard
        Fixes redundant queries in Main/views.py
        """
        return queryset.select_related().order_by('date')
    
    @staticmethod
    def batch_fetch_by_date(models_and_keys: List[tuple], date_filter: str) -> Dict[str, Any]:
        """
        Batch fetch multiple models by date to reduce queries
        
        Args:
            models_and_keys: List of (model_class, key_name) tuples
            date_filter: Date string for filtering
            
        Returns:
            Dictionary with key_name -> model_instance mapping
        """
        results = {}
        
        for model_class, key in models_and_keys:
            try:
                result = model_class.objects.filter(date=date_filter).first()
                results[key] = result
            except Exception as e:
                logger.error(f"Error fetching {key} for date {date_filter}: {str(e)}")
                results[key] = None
        
        return results


# =============================================================
# Caching Utilities
# =============================================================

from django.core.cache import cache
from django.core.cache.utils import make_template_fragment_key

class CacheManager:
    """
    Centralized cache management for common operations
    """
    
    CACHE_TIMEOUTS = {
        'dashboard_data': 300,  # 5 minutes
        'chart_data': 600,      # 10 minutes
        'field_options': 1800,  # 30 minutes
        'user_permissions': 900  # 15 minutes
    }
    
    @classmethod
    def get_or_set(cls, key: str, callable_func, timeout: str = 'dashboard_data'):
        """
        Get from cache or set with callable
        """
        cache_timeout = cls.CACHE_TIMEOUTS.get(timeout, 300)
        
        cached_value = cache.get(key)
        if cached_value is not None:
            return cached_value
        
        try:
            fresh_value = callable_func()
            cache.set(key, fresh_value, cache_timeout)
            return fresh_value
        except Exception as e:
            logger.error(f"Error setting cache for key {key}: {str(e)}")
            return None
    
    @classmethod
    def invalidate_pattern(cls, pattern: str):
        """
        Invalidate cache keys matching pattern
        """
        try:
            cache.delete_many(cache.keys(pattern))
        except Exception as e:
            logger.error(f"Error invalidating cache pattern {pattern}: {str(e)}")


# =============================================================
# Model Field Utilities
# =============================================================

def generate_field_info(model_class, exclude_fields: List[str] = None) -> Dict[str, Dict[str, Any]]:
    """
    Automatically generate FIELD_INFO dictionary for models
    Eliminates manual field info duplication
    """
    if exclude_fields is None:
        exclude_fields = ['id', 'created_at', 'updated_at']
    
    field_info = {}
    
    for field in model_class._meta.fields:
        if field.name in exclude_fields:
            continue
        
        field_info[field.name] = {
            'type': field.__class__.__name__.lower(),
            'verbose_name': getattr(field, 'verbose_name', field.name),
            'max_length': getattr(field, 'max_length', None),
            'null': field.null,
            'blank': field.blank,
            'choices': getattr(field, 'choices', None)
        }
    
    return field_info


# =============================================================
# Error Handling Decorators
# =============================================================

def handle_common_errors(view_func):
    """
    Decorator to handle common view errors consistently
    """
    def wrapper(request, *args, **kwargs):
        try:
            return view_func(request, *args, **kwargs)
        except json.JSONDecodeError:
            return create_error_response('無效的 JSON 數據', 400, 'json_error')
        except ValidationError as e:
            return create_error_response(f'驗證錯誤: {str(e)}', 400, 'validation_error')
        except Exception as e:
            logger.error(f"Unexpected error in {view_func.__name__}: {str(e)}", exc_info=True)
            return create_error_response('伺服器內部錯誤', 500, 'server_error')
    
    return wrapper