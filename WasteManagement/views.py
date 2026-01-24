import json
import logging
import sqlite3
import time
from datetime import datetime
from collections import Counter

from dateutil import relativedelta
from django.db import transaction, OperationalError, connections
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import render
from django.middleware.csrf import get_token
from django.views.decorators.csrf import csrf_exempt, csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_http_methods

from MedicalWasteManagementSystem.permissions import *
from .visualization_service import VisualizeDataService, VisualizeRequestValidator
from MedicalWasteManagementSystem.date_validators import (
    validate_yyyy_mm_format
)
from WasteManagement.models import *

# Set up logging
logger = logging.getLogger(__name__)

TABLE_MAPPING = {
    "general_waste_production": GeneralWasteProduction,
    "biomedical_waste_production": BiomedicalWasteProduction,
    "dialysis_bucket_soft_bag_production_and_disposal_costs": DialysisBucketSoftBagProductionAndDisposalCosts,
    "pharmaceutical_glass_production_and_disposal_costs": PharmaceuticalGlassProductionAndDisposalCosts,
    "paper_iron_aluminum_can_plastic_and_glass_production_and_recycling_revenue": PaperIronAluminumCanPlasticAndGlassProductionAndRecyclingRevenue
}


# Dynamic configuration for visualize components
def get_visualize_config(request):
    """Generate complete configuration for visualize components."""
    # Field configuration from models
    fields = {}
    for table_name, model_class in TABLE_MAPPING.items():
        if hasattr(model_class, 'FIELD_INFO'):
            fields[table_name] = model_class.FIELD_INFO

    # Table display names
    table_names = {
        'general_waste_production': '一般事業廢棄物產出',
        'biomedical_waste_production': '生物醫療廢棄物產出',
        'dialysis_bucket_soft_bag_production_and_disposal_costs': '洗腎桶軟袋產出及處理費用表',
        'pharmaceutical_glass_production_and_disposal_costs': '藥用玻璃產出及處理費用表',
        'paper_iron_aluminum_can_plastic_and_glass_production_and_recycling_revenue': '紙鐵鋁罐塑膠玻璃產出及回收收入表',
    }

    # Y-axis options configuration
    y_axis_options = [
        {'value': 'metric_ton', 'text': '以重量劃分 - 公噸', 'unit_type': 'weight', 'base_unit': 'metric_ton'},
        {'value': 'kilogram', 'text': '以重量劃分 - 公斤', 'unit_type': 'weight', 'base_unit': 'kilogram'},
        {'value': 'weight_percentage_metric_ton', 'text': '以重量劃分 - 百分比(公噸)', 'unit_type': 'weight_percentage',
         'base_unit': 'metric_ton'},
        {'value': 'weight_percentage_kilogram', 'text': '以重量劃分 - 百分比(公斤)', 'unit_type': 'weight_percentage',
         'base_unit': 'kilogram'},
        {'value': 'new_taiwan_dollar', 'text': '以金額劃分 - 新台幣', 'unit_type': 'currency',
         'base_unit': 'new_taiwan_dollar'},
        {'value': 'cost_percentage_new_taiwan_dollar', 'text': '以金額劃分 - 百分比(新台幣)',
         'unit_type': 'currency_percentage', 'base_unit': 'new_taiwan_dollar'},
    ]

    # X-axis options configuration
    x_axis_options = [
        {'value': 'year_sum', 'text': '以年份劃分 - 總和', 'aggregation': 'sum', 'time_unit': 'year'},
        {'value': 'year_avg', 'text': '以年份劃分 - 平均', 'aggregation': 'avg', 'time_unit': 'year'},
        {'value': 'quarter_sum', 'text': '以季度劃分 - 總和', 'aggregation': 'sum', 'time_unit': 'quarter'},
        {'value': 'quarter_avg', 'text': '以季度劃分 - 平均', 'aggregation': 'avg', 'time_unit': 'quarter'},
        {'value': 'month', 'text': '以月份劃分', 'aggregation': 'sum', 'time_unit': 'month'},
        {'value': 'only_month', 'text': '只有月份', 'aggregation': 'sum', 'time_unit': 'only_month'},
    ]

    # Chart type configuration
    chart_types = [
        {'value': 'bar', 'text': '柱狀圖', 'icon': 'chart-column', 'supports_percentage': False},
        {'value': 'line', 'text': '線圖', 'icon': 'chart-line', 'supports_percentage': False},
        {'value': 'pie', 'text': '圓餅圖', 'icon': 'chart-pie', 'supports_percentage': False,
         'requires_aggregation': True},
        {'value': 'donut', 'text': '甜甜圈圖', 'icon': 'chart-pie', 'supports_percentage': False,
         'requires_aggregation': True},
        {'value': 'stacked_bar', 'text': '堆疊柱狀圖', 'icon': 'chart-column', 'supports_percentage': True},
    ]

    # Unit display mapping
    unit_display = {
        'metric_ton': '公噸',
        'kilogram': '公斤',
        'new_taiwan_dollar': '新台幣'
    }

    # Export configuration
    export_config = {
        'formats': [
            {'value': 'xlsx', 'text': 'Excel檔案', 'icon': 'file-excel'},
            {'value': 'png', 'text': 'PNG圖片', 'icon': 'file-image'},
            {'value': 'pdf', 'text': 'PDF文件', 'icon': 'file-pdf'},
            {'value': 'print', 'text': '列印', 'icon': 'print'}
        ],
        'layouts': {
            'xlsx': [
                {'value': 'separate', 'text': '每個圖表一個檔案'},
                {'value': 'multiple_sheets', 'text': '一個檔案多個工作表'},
                {'value': 'single_sheet', 'text': '一個檔案一個工作表'}
            ],
            'png': [
                {'value': 'separate', 'text': '每個圖表一個檔案'},
                {'value': 'combined', 'text': '所有圖表合併'}
            ],
            'pdf': [
                {'value': 'separate', 'text': '每個圖表一頁'},
                {'value': 'combined', 'text': '所有圖表一份文件'}
            ],
            'print': [
                {'value': 'separate', 'text': '每個圖表分別列印'},
                {'value': 'combined', 'text': '所有圖表一起列印'}
            ]
        },
        'themes': [
            {'value': 'light', 'text': '淺色主題'},
            {'value': 'dark', 'text': '深色主題'}
        ]
    }

    # Unified configuration object
    config = {
        'fields': fields,
        'tableNames': table_names,
        'yAxisOptions': y_axis_options,
        'xAxisOptions': x_axis_options,
        'chartTypes': chart_types,
        'unitDisplay': unit_display,
        'exportConfig': export_config,
        'csrfToken': get_token(request),
        'version': '2.0.0'  # Version for cache busting
    }

    return config


def retry_on_lock(func, max_retries=999999, delay=0.5):
    def wrapper(*args, **kwargs):
        for attempt in range(max_retries):
            try:
                with transaction.atomic():
                    return func(*args, **kwargs)
            except OperationalError as e:
                if "database is locked" in str(e):
                    logger.warning(f"Database locked in {func.__name__}, attempt {attempt + 1}/{max_retries}")
                    if attempt < max_retries - 1:
                        time.sleep(delay)
                        continue
                raise e
        logger.error(f"Failed to execute {func.__name__} after {max_retries} attempts due to persistent lock")
        raise OperationalError("Database remained locked after maximum retries")

    return wrapper


def get_model_info(table_name):
    """Get model info including dynamic field configuration"""
    model = TABLE_MAPPING.get(table_name)
    if not model:
        return None, [], {}

    # For GeneralWasteProduction, use JSON config if available
    if table_name == 'general_waste_production' and hasattr(model, 'get_field_config'):
        config = model.get_field_config()
        fields_config = config.get('fields', {})

        if fields_config:
            # Get all fields from model
            all_model_fields = [f.name for f in model._meta.fields if f.name != 'date']

            # Filter to only visible fields (excluding 'total')
            visible_fields = [
                field_name for field_name in all_model_fields
                if field_name in fields_config and fields_config[field_name].get('visible', False) and field_name != 'total'
            ]

            # Add 'total' at the end (it should always be visible but not editable)
            if 'total' in all_model_fields:
                visible_fields.append('total')

            # Build FIELD_INFO from JSON config - pass all properties to frontend
            field_info = {
                field_name: fields_config[field_name]
                for field_name in visible_fields
                if field_name in fields_config
            }

            return model, visible_fields, field_info

    # For other models, use original logic
    fields = [f.name for f in model._meta.fields if f.name != 'date']
    return model, fields, model.FIELD_INFO


# validate_date_format function moved to MedicalWasteManagementSystem.utils


@ensure_csrf_cookie
@permission_required("registrar")
def database_index(request):
    table_name = request.POST.get("table") or request.GET.get("table", "general_waste_production")
    model, fields, field_info = get_model_info(table_name)

    start_date = request.POST.get("start_date", "") or ""
    end_date = request.POST.get("end_date", "") or ""
    edit_date = request.POST.get("edit_date") if request.method == "POST" and request.POST.get("action") in ["edit",
                                                                                                             "save"] else None
    adding = request.method == "POST" and request.POST.get("action") == "add"
    error = None

    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'

    if request.method == "POST" and not is_ajax:
        action = request.POST.get("action")
        if action == "delete":
            dates = request.POST.getlist("selected_dates")
            if dates:
                delete_data_logic(table_name, dates)
        elif action == "filter":
            start_date = request.POST.get("start_date", "")
            end_date = request.POST.get("end_date", "")
        elif action == "clear":
            start_date = end_date = ""
        elif action == "edit":
            edit_date = request.POST.get("edit_date")
        elif action == "add":
            adding = True
        elif action == "cancel":
            adding = False
            edit_date = None
        elif action == "save":
            date = request.POST.get("new_date") or request.POST.get("edit_date")
            is_valid, error_msg = validate_yyyy_mm_format(date)
            if not is_valid:
                error = error_msg
            elif model.objects.filter(date=date).exists() and date != request.POST.get("edit_date", ""):
                error = f"日期 {date} 已存在"
                edit_date = request.POST.get("edit_date")
                if not edit_date:
                    adding = True
            else:
                defaults = {}
                for field in fields:
                    value = request.POST.get(f"new_{field}") or request.POST.get(f"edit_{field}")
                    if value:
                        defaults[field] = float(value) if isinstance(model._meta.get_field(field),
                                                                     models.FloatField) else int(value)
                    elif value == "":
                        defaults[field] = None
                model.objects.update_or_create(date=date, defaults=defaults)
                adding = False
                edit_date = None

    data = list(model.objects.filter(
        Q(date__gte=start_date) if start_date else Q(),
        Q(date__lte=end_date) if end_date else Q()
    ).order_by('date').values("date", *fields)) if model else []

    return render(request, 'management/database.html', {
        "data": data,
        "fields": list(fields),
        "fields_json": json.dumps(list(fields)),
        "field_info": field_info,
        "field_info_json": json.dumps(field_info, ensure_ascii=False),
        "selected_table": table_name,
        "start_date": start_date,
        "end_date": end_date,
        "edit_date": edit_date,
        "adding": adding,
        "error": error
    })


@ensure_csrf_cookie
def visualize_index(request):
    """Handle visualization requests: render page for GET, process chart data for POST."""
    if request.method == 'GET':
        try:
            fields = {}
            table_names = {}  # Add table names mapping

            for table_name in TABLE_MAPPING.keys():
                # Use get_model_info() to get correct field configuration (including dynamic config from JSON)
                model, field_list, field_info = get_model_info(table_name)

                if model and field_info:
                    # Include ALL fields in visualize (including total fields for comprehensive data analysis)
                    # Don't filter out 'total' fields - users need to see aggregated data too
                    fields[table_name] = field_info
                    # Get table name from model's verbose_name
                    table_names[table_name] = model._meta.verbose_name

            context = {
                'fields': json.dumps(fields, ensure_ascii=False),
                'table_names': json.dumps(table_names, ensure_ascii=False)  # Add this line
            }
            logger.debug(f"Fields sent to template: {json.dumps(fields, ensure_ascii=False, indent=2)}")
            logger.debug(f"Table names sent to template: {json.dumps(table_names, ensure_ascii=False, indent=2)}")
            return render(request, 'management/visualize.html', context)
        except Exception as e:
            logger.error(f"GET error: {str(e)}", exc_info=True)
            return render(request, 'management/visualize.html', {
                'fields': json.dumps({}),
                'table_names': json.dumps({})  # Add this line
            })

    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            
            # Use the new validation service
            is_valid, error_msg, cleaned_data = VisualizeRequestValidator.validate_chart_request(data)
            if not is_valid:
                logger.warning(f"Request validation failed: {error_msg}")
                return JsonResponse({'success': False, 'error': error_msg})
            
            # Extract validated data
            chart_type = cleaned_data['chart_type']
            y_axis = cleaned_data['y_axis']
            x_axis = cleaned_data['x_axis']
            datasets = cleaned_data['datasets']
            title = cleaned_data['title']
            show_values = cleaned_data['show_values']

            # Calculate global time range
            all_start_dates = [d['start_date'][:7] for d in datasets]
            all_end_dates = [d['end_date'][:7] for d in datasets]
            global_start = min(all_start_dates)
            global_end = max(all_end_dates)

            # Generate global labels
            if x_axis == 'only_month':
                global_labels = generate_only_month_labels(datasets, global_start, global_end)
            else:
                global_labels = generate_date_range(global_start, global_end, x_axis)

            # Process datasets using optimized service
            chart_data = []
            for dataset in datasets:
                table = dataset.get('table')
                field = dataset.get('field')
                start_date = dataset.get('start_date')
                end_date = dataset.get('end_date')
                model_class = TABLE_MAPPING.get(table)

                # Use get_model_info() to get dynamic field configuration
                model_class, field_list, field_info = get_model_info(table)

                if not model_class or not field_info or field not in field_info:
                    logger.warning(f"Invalid table ({table}) or field ({field}). Available fields: {list(field_info.keys() if field_info else [])}")
                    continue

                # Use optimized data service with fallback to original logic
                only_month_context = {
                    'global_labels': global_labels if x_axis == 'only_month' else None
                }

                try:
                    # Try the new optimized service first
                    row_data = VisualizeDataService.get_optimized_data(
                        model_class, field_info, y_axis, start_date, end_date,
                        x_axis, field, only_month_context
                    )
                    
                    # Check if we got valid data, if all zeros, try the original method
                    if row_data and row_data.get('data') and all(val == 0 for val in row_data['data']):
                        logger.warning(f"Optimized service returned all zeros, falling back to original method for {table}:{field}")
                        # Fall back to original process_data_row function
                        row_data = process_data_row(
                            model_class, field_info, y_axis, start_date, end_date,
                            x_axis, field, only_month_context
                        )
                        logger.info(f"Fallback method returned: {len(row_data.get('data', []))} data points for {table}:{field}")
                        if row_data.get('data'):
                            logger.info(f"First 5 fallback values: {row_data['data'][:5]}")
                except Exception as e:
                    logger.error(f"Optimized service failed for {table}:{field}, falling back: {str(e)}")
                    # Fall back to original process_data_row function
                    row_data = process_data_row(
                        model_class, field_info, y_axis, start_date, end_date,
                        x_axis, field, only_month_context
                    )

                # Align data to global labels
                aligned_data = [
                    row_data['data'][row_data['labels'].index(label)] if label in row_data['labels'] else 0
                    for label in global_labels
                ]
                aligned_raw_data = [
                    row_data['raw_data'][row_data['labels'].index(label)] if label in row_data['labels'] else 0
                    for label in global_labels
                ]
                
                chart_data.append({
                    'name': dataset.get('name', f"{field_info[field]['name']} ({start_date[:7]} 至 {end_date[:7]})"),
                    'data': aligned_data,
                    'raw_data': aligned_raw_data,
                    'unit': field_info[field]['unit'],
                    'color': dataset.get('color', '#000000'),
                })

            # Handle percentage conversion with optimized calculation
            if 'percentage' in y_axis and chart_type not in ['pie', 'donut']:
                total_sums = [sum(row['data'][i] for row in chart_data) for i in range(len(global_labels))]
                for row in chart_data:
                    row['data'] = [
                        round(row['data'][i] / total_sums[i] * 100, 2) if total_sums[i] else 0
                        for i in range(len(global_labels))
                    ]

            # Build optimized response
            response = {
                'success': True,
                'chart_type': chart_type,
                'x_axis_labels': global_labels,
                'series': chart_data,
                'title': title or f"廢棄物報表 ({y_axis} vs {x_axis})",
                'show_values': show_values,
            }
            
            logger.debug(f"Optimized response generated for {len(datasets)} datasets")
            return JsonResponse(response)

        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON: {str(e)}")
            return JsonResponse({'success': False, 'error': '無效的 JSON 數據'})
        except Exception as e:
            logger.error(f"POST error: {str(e)}", exc_info=True)
            return JsonResponse({'success': False, 'error': f'伺服器錯誤: {str(e)}'})

    return JsonResponse({'success': False, 'error': '不支援的請求方法'})


# Additional utility endpoint for getting server time
def get_server_time(request):
    """Return current server time for report generation."""
    return JsonResponse({
        'serverTime': datetime.now().isoformat(),
        'timestamp': time.time()
    })

@csrf_protect
@require_http_methods(["POST"])
@permission_required("registrar")
def batch_import(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "error": "無效請求"})

    try:
        data = json.loads(request.body.decode('utf-8'))
        table_name = data.get("table")
        rows = data.get("rows", [])
        override_conflicts = data.get("override_conflicts", False)

        if not table_name or not rows:
            return JsonResponse({"success": False, "error": "缺少必要參數"})

        # Security check: Verify override permission
        if override_conflicts:
            from MedicalWasteManagementSystem.permissions import has_override_permission
            if not has_override_permission(request.user, 'management'):
                logger.warning(f"User {request.user.username} attempted override without permission")
                return JsonResponse({"success": False, "error": "您沒有覆寫資料的權限"})

        # Get the model class
        model = TABLE_MAPPING.get(table_name)
        if not model:
            return JsonResponse({"success": False, "error": "無效的表格名稱"})

        logger.info(f"Database batch import started: {table_name}, {len(rows)} rows, override={override_conflicts}")

        # Get field names from the model
        fields = [field.name for field in model._meta.fields if field.name != 'id']

        # Initialize results
        results = {
            "total": len(rows),
            "success": 0,
            "failed": [],
            "conflicts": []
        }

        # ===== OPTIMIZATION: Preload all existing dates (1 query) =====
        all_dates = [row.get('date') for row in rows if row.get('date')]
        existing_dates = set(
            model.objects.filter(date__in=all_dates).values_list('date', flat=True)
        )

        logger.debug(f"Preloaded {len(existing_dates)} existing dates")

        # ===== OPTIMIZATION: Validate and categorize all rows =====
        rows_to_create = []
        rows_to_update = []

        for idx, row in enumerate(rows):
            try:
                # Validate date format
                date_value = row.get('date')
                is_valid, error_msg = validate_yyyy_mm_format(date_value)
                if not is_valid:
                    results["failed"].append({
                        "index": idx,
                        "reason": error_msg,
                        "data": row
                    })
                    continue

                # O(1) conflict check using set
                has_conflict = date_value in existing_dates

                if has_conflict and not override_conflicts:
                    results["conflicts"].append({
                        "index": idx,
                        "reason": "資料已存在",
                        "data": row
                    })
                    continue

                # Validate and prepare record data
                record_data = {"date": date_value}
                validation_failed = False

                for field in fields:
                    if field == 'date':
                        continue

                    # Skip auto-calculated fields like 'total'
                    if field == 'total':
                        continue

                    value = row.get(field, "")
                    if value == "" or value is None:
                        record_data[field] = None
                    else:
                        try:
                            field_obj = model._meta.get_field(field)
                            if isinstance(field_obj, models.FloatField):
                                record_data[field] = float(str(value).strip()) if str(value).strip() else None
                            elif isinstance(field_obj, models.IntegerField):
                                record_data[field] = int(str(value).strip()) if str(value).strip() else None
                            else:
                                record_data[field] = str(value).strip() if value else None
                        except (ValueError, TypeError) as e:
                            results["failed"].append({
                                "index": idx,
                                "reason": f"欄位 {field} 資料格式錯誤: {str(e)}",
                                "data": row
                            })
                            validation_failed = True
                            break

                if validation_failed:
                    continue

                # Categorize for batch processing
                if has_conflict and override_conflicts:
                    rows_to_update.append((idx, record_data))
                else:
                    rows_to_create.append(record_data)

            except Exception as e:
                results["failed"].append({
                    "index": idx,
                    "reason": f"處理資料失敗: {str(e)}",
                    "data": row
                })

        # ===== OPTIMIZATION: Bulk create all new records =====
        if rows_to_create:
            try:
                with transaction.atomic():
                    # Auto-calculate 'total' field for models that have it
                    for data in rows_to_create:
                        if hasattr(model, 'total'):
                            # Calculate total based on model type
                            if table_name == 'general_waste_production':
                                # Sum all fields except date and total
                                all_fields = [
                                    data.get('tainan'), data.get('renwu'),
                                    data.get('field_1'), data.get('field_2'), data.get('field_3'),
                                    data.get('field_4'), data.get('field_5'), data.get('field_6'),
                                    data.get('field_7'), data.get('field_8'), data.get('field_9'),
                                    data.get('field_10')
                                ]
                                data['total'] = sum(f or 0 for f in all_fields)
                            elif table_name == 'biomedical_waste_production':
                                # Sum only red_bag and yellow_bag
                                data['total'] = (data.get('red_bag') or 0) + (data.get('yellow_bag') or 0)

                    # Create model instances
                    instances = [model(**data) for data in rows_to_create]

                    # Bulk create
                    model.objects.bulk_create(instances, batch_size=100)
                    results["success"] += len(rows_to_create)

                    logger.debug(f"Bulk created {len(rows_to_create)} records")
            except Exception as e:
                logger.error(f"Bulk create failed: {str(e)}", exc_info=True)
                # Fallback to individual creates
                for data in rows_to_create:
                    try:
                        model.objects.create(**data)
                        results["success"] += 1
                    except Exception as e2:
                        results["failed"].append({
                            "reason": f"建立失敗 (date={data.get('date')}): {str(e2)}"
                        })

        # ===== OPTIMIZATION: Bulk update using delete + create strategy =====
        if rows_to_update:
            try:
                with transaction.atomic():
                    # Delete all existing records
                    dates_to_delete = [data['date'] for idx, data in rows_to_update]
                    deleted_count = model.objects.filter(date__in=dates_to_delete).delete()[0]
                    logger.debug(f"Deleted {deleted_count} existing records for update")

                    # Auto-calculate 'total' field for models that have it
                    update_data_list = [data for idx, data in rows_to_update]
                    for data in update_data_list:
                        if hasattr(model, 'total'):
                            # Calculate total based on model type
                            if table_name == 'general_waste_production':
                                # Sum all fields except date and total
                                all_fields = [
                                    data.get('tainan'), data.get('renwu'),
                                    data.get('field_1'), data.get('field_2'), data.get('field_3'),
                                    data.get('field_4'), data.get('field_5'), data.get('field_6'),
                                    data.get('field_7'), data.get('field_8'), data.get('field_9'),
                                    data.get('field_10')
                                ]
                                data['total'] = sum(f or 0 for f in all_fields)
                            elif table_name == 'biomedical_waste_production':
                                # Sum only red_bag and yellow_bag
                                data['total'] = (data.get('red_bag') or 0) + (data.get('yellow_bag') or 0)

                    # Bulk create updated records
                    updated_instances = [model(**data) for data in update_data_list]
                    model.objects.bulk_create(updated_instances, batch_size=100)
                    results["success"] += len(rows_to_update)

                    logger.debug(f"Bulk updated {len(rows_to_update)} records via delete+create")
            except Exception as e:
                logger.error(f"Bulk update failed: {str(e)}", exc_info=True)
                # Fallback to individual updates
                for idx, data in rows_to_update:
                    try:
                        with transaction.atomic():
                            model.objects.filter(date=data['date']).delete()
                            model.objects.create(**data)
                            results["success"] += 1
                    except Exception as e2:
                        results["failed"].append({
                            "index": idx,
                            "reason": f"更新失敗: {str(e2)}"
                        })

        logger.info(f"Database batch import completed: {table_name}, {results['success']} success, {len(results['failed'])} failed, {len(results['conflicts'])} conflicts")

        # Check if we have unresolved conflicts
        if results["conflicts"] and not override_conflicts:
            return JsonResponse({
                "success": False,
                "error": "資料衝突",
                "results": results
            })

        return JsonResponse({
            "success": True,
            "results": results
        })

    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "無效的 JSON 數據"})
    except Exception as e:
        logger.error(f"Batch import error: {str(e)}", exc_info=True)
        return JsonResponse({"success": False, "error": f"伺服器錯誤: {str(e)}"})


# process_batch_create function moved to MedicalWasteManagementSystem.utils.BatchProcessor


def process_batch_update(model, fields, rows_to_update, results):
    """Process batch updates with optimized performance."""
    # For updates, process one at a time as SQLite has limited batch update capability
    success_count = 0

    for idx, row in rows_to_update:
        date = row.get('date')

        try:
            # Prepare update data
            update_data = {}
            for field in fields:
                value = row.get(field)
                if value and value.strip():
                    if isinstance(model._meta.get_field(field), models.FloatField):
                        update_data[field] = float(value.strip())
                    elif isinstance(model._meta.get_field(field), models.IntegerField):
                        update_data[field] = int(value.strip())
                else:
                    update_data[field] = None

            # Apply update with retry logic
            success = False
            retry_count = 0
            max_retries = 3

            while not success and retry_count < max_retries:
                try:
                    with transaction.atomic():
                        # Use two-step process: delete and create for better locking behavior
                        model.objects.filter(date=date).delete()
                        model.objects.create(date=date, **update_data)
                        success = True
                        success_count += 1
                except OperationalError as e:
                    if "database is locked" in str(e) and retry_count < max_retries - 1:
                        connections.close_all()
                        retry_count += 1
                        delay = 0.2 * (2 ** retry_count)  # Exponential backoff
                        time.sleep(delay)
                        logger.warning(f"Retrying update for row {idx} after lock error (attempt {retry_count})")
                    else:
                        results["failed"].append({
                            "index": idx,
                            "reason": f"資料庫鎖定錯誤: {str(e)}",
                            "data": row
                        })
                        break
                except Exception as e:
                    results["failed"].append({
                        "index": idx,
                        "reason": f"更新資料失敗: {str(e)}",
                        "data": row
                    })
                    break
        except Exception as e:
            results["failed"].append({
                "index": idx,
                "reason": f"處理資料失敗: {str(e)}",
                "data": row
            })

    return success_count


@csrf_protect
@require_http_methods(["POST"])
@permission_required("registrar")
def save_data(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "error": "無效請求"})

    @retry_on_lock
    def save_logic(data):
        table_name = data.get("table")
        model, fields, field_info = get_model_info(table_name)
        if not model:
            raise ValueError("無效的表格名稱")

        date = data.get("date")
        original_date = data.get("original_date", "")
        is_valid, error_msg = validate_yyyy_mm_format(date)
        if not is_valid:
            raise ValueError(error_msg)

        # Security check: Verify override permission when updating existing data
        if original_date:  # Any edit to existing data requires override permission
            from MedicalWasteManagementSystem.permissions import has_override_permission
            if not has_override_permission(request.user, 'management'):
                logger.warning(f"User {request.user.username} attempted override in save_data without permission")
                return {"success": False, "error": "您沒有覆寫資料的權限"}

        if model.objects.filter(date=date).exists() and date != original_date:
            return {"success": False, "error": f"日期 {date} 已存在"}

        defaults = {}
        for field in fields:
            # Skip auto-calculated fields like 'total'
            if field == 'total':
                continue

            value = data.get(field)
            if value:
                if isinstance(model._meta.get_field(field), models.FloatField):
                    defaults[field] = float(value)  # No decimal restriction
                elif isinstance(model._meta.get_field(field), models.IntegerField):
                    defaults[field] = int(value)
            elif value == "":
                defaults[field] = None

        # Use transaction for better lock handling
        with transaction.atomic():
            if original_date and original_date != date:
                model.objects.filter(date=original_date).delete()

            # Use explicit get-or-create and save to ensure save() method is called
            try:
                instance = model.objects.get(date=date)
                # Update existing record
                for field, value in defaults.items():
                    setattr(instance, field, value)
                instance.save()  # This triggers the save() method with auto-calculation
            except model.DoesNotExist:
                # Create new record
                instance = model(date=date, **defaults)
                instance.save()  # This triggers the save() method with auto-calculation

        return {"success": True}

    try:
        data = json.loads(request.body.decode('utf-8'))
        result = save_logic(data)
        return JsonResponse(result)
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "無效的 JSON 數據"})
    except ValueError as e:
        return JsonResponse({"success": False, "error": str(e)})
    except Exception as e:
        logger.error(f"Save data error: {str(e)}", exc_info=True)
        return JsonResponse({"success": False, "error": f"伺服器錯誤: {str(e)}"})


@csrf_protect
@require_http_methods(["POST"])
@permission_required("registrar")
def delete_data(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "error": "無效請求"})

    @retry_on_lock
    def delete_logic(data):
        table_name = data.get("table")
        dates = data.get("dates", [])
        if not dates:
            raise ValueError("未選擇任何資料進行刪除")

        model, _, _ = get_model_info(table_name)
        if not model:
            raise ValueError("無效的表格名稱")

        # Get data before deletion for potential undo functionality
        deleted_data = list(model.objects.filter(date__in=dates).values('date', *model.FIELD_INFO.keys()))

        # Use transaction for better atomicity and lock handling
        with transaction.atomic():
            deleted_count = model.objects.filter(date__in=dates).delete()[0]

        if deleted_count != len(dates):
            raise ValueError("部分資料未能成功刪除")

        return {"success": True, "deleted_data": deleted_data}

    try:
        data = json.loads(request.body.decode('utf-8'))
        result = delete_logic(data)
        return JsonResponse(result)
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "無效的 JSON 數據"})
    except ValueError as e:
        return JsonResponse({"success": False, "error": str(e)})
    except Exception as e:
        logger.error(f"Delete data error: {str(e)}", exc_info=True)
        return JsonResponse({"success": False, "error": f"伺服器錯誤: {str(e)}"})


@csrf_protect
@require_http_methods(["GET"])
@permission_required("registrar")
def get_data(request):
    table_name = request.GET.get("table")
    date = request.GET.get("date")
    model, fields, _ = get_model_info(table_name)
    if not model or not date:
        logger.debug(f"get_data: Invalid parameters - table={table_name}, date={date}")
        return JsonResponse({"success": False, "error": "無效的請求參數"})
    try:
        record = model.objects.filter(date=date).values("date", *fields).first()
        if record:
            logger.debug(f"get_data: Found record for table={table_name}, date={date}")
            return JsonResponse(record)
        logger.debug(f"get_data: No data found for table={table_name}, date={date}")
        return JsonResponse({"success": False, "error": "資料不存在"})
    except Exception as e:
        logger.error(f"get_data: Error - table={table_name}, date={date}, error={str(e)}")
        return JsonResponse({"success": False, "error": f"伺服器錯誤: {str(e)}"})


def delete_data_logic(table_name, dates):
    model, _, _ = get_model_info(table_name)
    if model and dates:
        valid_dates = []
        for d in dates:
            is_valid, _ = validate_yyyy_mm_format(d)
            if is_valid:
                valid_dates.append(d)
        if valid_dates:
            try:
                model.objects.filter(date__in=valid_dates).delete()
            except sqlite3.OperationalError as e:
                logger.error(f"Database error in delete: {e}")
                raise


def check_has_full_year_dataset(datasets):
    """
    Check if any dataset covers a complete year (1-12 months in the same year)

    Args:
        datasets: List of dataset dictionaries with start_date and end_date

    Returns:
        bool: True if any dataset covers a full year
    """
    for dataset in datasets:
        start_date = dataset.get('start_date', '')
        end_date = dataset.get('end_date', '')

        if start_date and end_date:
            # Extract year-month parts
            start_year_month = start_date[:7]  # YYYY-MM format
            end_year_month = end_date[:7]  # YYYY-MM format

            try:
                start_year, start_month = start_year_month.split('-')
                end_year, end_month = end_year_month.split('-')

                # Check if it's the same year and covers January to December
                if (start_year == end_year and
                        start_month == '01' and
                        end_month == '12'):
                    return True
            except (ValueError, IndexError):
                continue

    return False


def detect_annual_cycle_pattern(datasets):
    """
    Detect if datasets follow a consistent annual cycle pattern (like fiscal years)

    Args:
        datasets: List of dataset dictionaries with start_date and end_date

    Returns:
        tuple: (has_pattern, start_month) where start_month is 1-12 or None
    """
    if len(datasets) < 2:
        return False, None

    # Extract start months from multi-year datasets
    start_months = []

    for dataset in datasets:
        start_date = dataset.get('start_date', '')
        end_date = dataset.get('end_date', '')

        if start_date and end_date:
            try:
                start_year_month = start_date[:7]
                end_year_month = end_date[:7]

                start_year, start_month = start_year_month.split('-')
                end_year, end_month = end_year_month.split('-')

                start_year, start_month = int(start_year), int(start_month)
                end_year, end_month = int(end_year), int(end_month)

                # Check if this dataset spans multiple months (at least 6 months)
                # and possibly multiple years
                if end_year > start_year or (end_year == start_year and end_month - start_month >= 5):
                    start_months.append(start_month)

            except (ValueError, IndexError):
                continue

    if len(start_months) < 2:
        return False, None

    # Count occurrences of each start month
    month_counts = Counter(start_months)

    # If at least 2 datasets start with the same month, consider it a pattern
    most_common_month, count = month_counts.most_common(1)[0]

    if count >= 2:
        return True, most_common_month

    return False, None


def generate_fiscal_year_labels(start_month):
    """
    Generate month labels starting from a specific month (for fiscal years)

    Args:
        start_month: Starting month (1-12)

    Returns:
        list: List of month labels in fiscal year order
    """
    labels = []
    for i in range(12):
        month = ((start_month - 1 + i) % 12) + 1
        labels.append(f"{month:02d}")
    return labels


def generate_only_month_labels(datasets, global_start, global_end):
    """
    Generate month labels for only_month x-axis with intelligent pattern detection

    Args:
        datasets: List of dataset dictionaries
        global_start: Global start date (YYYY-MM format)
        global_end: Global end date (YYYY-MM format)

    Returns:
        list: List of month labels
    """
    # First, check if any dataset covers a full calendar year (Jan-Dec)
    if check_has_full_year_dataset(datasets):
        return [f"{i:02d}" for i in range(1, 13)]

    # Second, detect annual cycle patterns (like fiscal years)
    has_pattern, pattern_start_month = detect_annual_cycle_pattern(datasets)
    if has_pattern:
        return generate_fiscal_year_labels(pattern_start_month)

    # Third, fallback to chronological order based on actual date range
    try:
        start = datetime.strptime(global_start, '%Y-%m')
        end = datetime.strptime(global_end, '%Y-%m')
    except (ValueError, TypeError):
        # Fallback to standard months if date parsing fails
        return [f"{i:02d}" for i in range(1, 13)]

    labels = []
    current = start

    while current <= end:
        month_label = current.strftime('%m')
        if month_label not in labels:
            labels.append(month_label)
        current += relativedelta.relativedelta(months=1)

    return labels


def get_unit_from_y_axis(y_axis):
    """Extract the base unit from the Y-axis selection for standardization."""
    if y_axis == 'metric_ton':
        return 'metric_ton'
    elif y_axis == 'kilogram':
        return 'kilogram'
    elif y_axis == 'new_taiwan_dollar':
        return 'new_taiwan_dollar'
    elif y_axis == 'weight_percentage':
        return 'kilogram'
    elif y_axis == 'weight_percentage_metric_ton':
        return 'metric_ton'
    elif y_axis == 'weight_percentage_kilogram':
        return 'kilogram'
    elif y_axis == 'cost_percentage_new_taiwan_dollar':
        return 'new_taiwan_dollar'
    return None


def standardize_value(from_unit, value, to_unit):
    """Convert a value from its original unit to the target unit with rounding."""
    if from_unit == to_unit:
        return round(value, 2)
    if from_unit == 'metric_ton' and to_unit == 'kilogram':
        return round(value * 1000, 2)
    if from_unit == 'kilogram' and to_unit == 'metric_ton':
        return round(value / 1000, 2)
    return round(value, 2)


def generate_date_range(start_date, end_date, x_axis):
    """Generate X-axis labels based on date range and aggregation type."""
    start_date = start_date[:7]
    end_date = end_date[:7]
    start = datetime.strptime(start_date, '%Y-%m')
    end = datetime.strptime(end_date, '%Y-%m')
    labels = []
    current = start
    x_axis_base = x_axis.split('_')[0] if '_' in x_axis else x_axis
    while current <= end:
        if x_axis_base == 'year':
            label = str(current.year)
        elif x_axis_base == 'quarter':
            quarter = (current.month - 1) // 3 + 1
            label = f"{current.year}-Q{quarter}"
        elif x_axis_base == 'month':
            label = current.strftime('%Y-%m')
        else:  # only_month
            label = current.strftime('%m')
        if label not in labels:
            labels.append(label)
        if x_axis_base == 'year':
            current = current.replace(year=current.year + 1)
        elif x_axis_base == 'quarter':
            current += relativedelta.relativedelta(months=3)
        else:
            current += relativedelta.relativedelta(months=1)
    return labels


def process_data_row(model_class, field_info, y_axis, start_date, end_date, x_axis, selected_field,
                     only_month_context=None):
    """Aggregate data for a single dataset, returning raw and standardized values."""
    y_axis_unit = get_unit_from_y_axis(y_axis)
    field_unit = field_info[selected_field]['unit']
    if field_unit not in ['metric_ton', 'kilogram', 'new_taiwan_dollar']:
        return {'data': [], 'raw_data': [], 'labels': []}

    start_date = start_date[:7]
    end_date = end_date[:7]
    records = model_class.objects.filter(date__gte=start_date, date__lte=end_date).values('date', selected_field)
    grouped_data = {}
    raw_grouped_data = {}
    count_per_group = {}

    for record in records:
        value = record.get(selected_field)
        if value is not None:
            standardized_value = standardize_value(field_unit, value, y_axis_unit)
            date_str = record['date']
            x_axis_base = x_axis.split('_')[0] if '_' in x_axis else x_axis
            if x_axis_base == 'year':
                label = date_str[:4]
            elif x_axis_base == 'quarter':
                month = int(date_str[5:7])
                quarter = (month - 1) // 3 + 1
                label = f"{date_str[:4]}-Q{quarter}"
            elif x_axis_base == 'month':
                label = date_str
            else:  # only_month
                label = date_str[5:7]
            grouped_data[label] = grouped_data.get(label, 0) + standardized_value
            raw_grouped_data[label] = raw_grouped_data.get(label, 0) + value
            count_per_group[label] = count_per_group.get(label, 0) + 1

    # Use global labels for only_month if provided, otherwise generate labels
    if x_axis == 'only_month' and only_month_context and only_month_context.get('global_labels'):
        x_axis_labels = only_month_context['global_labels']
    else:
        x_axis_labels = generate_date_range(start_date, end_date, x_axis)

    series_data = []
    raw_series_data = []
    for label in x_axis_labels:
        value = grouped_data.get(label, 0)
        raw_value = raw_grouped_data.get(label, 0)
        if x_axis.endswith('avg') and value != 0:
            count = count_per_group.get(label, 1)
            series_data.append(round(value / count, 2))
            raw_series_data.append(round(raw_value / count, 2))
        else:
            series_data.append(round(value, 2))
            raw_series_data.append(round(raw_value, 2))
    return {'data': series_data, 'raw_data': raw_series_data, 'labels': x_axis_labels}

########################################################################################################################
#   DB - Department
########################################################################################################################

@ensure_csrf_cookie
@permission_required("registrar")
def db_department_index(request):
    """Department waste management main page"""
    config = DepartmentWasteConfiguration.get_configuration_data()

    context = {
        'departments': config['departments'],
        'waste_types': config['waste_types'],
        'unit_translations': config['unit_translations'],
        'department_mapping': config['department_mapping']
    }

    return render(request, 'management/db-department.html', context)


@require_http_methods(["GET"])
@permission_required("registrar")
def get_month_status(request):
    """Get month data status for year selector"""
    year = request.GET.get('year', '2025')
    waste_type_id = request.GET.get('waste_type_id')

    if not year.isdigit() or int(year) < 1970 or int(year) > 9999:
        return JsonResponse({'success': False, 'error': '無效的年份'})

    # Get waste type - use provided or default
    if waste_type_id:
        try:
            waste_type = WasteType.objects.get(id=waste_type_id, is_active=True)
        except WasteType.DoesNotExist:
            return JsonResponse({'success': False, 'error': '指定的廢棄物種類不存在'})
    else:
        waste_type = DepartmentWasteConfiguration.get_default_waste_type()
        if not waste_type:
            return JsonResponse({'success': False, 'error': '請指定廢棄物種類 ID，系統未設定預設廢棄物種類'})

    status = {}

    for month in range(1, 13):
        date = f"{year}-{month:02d}"

        # Check if any department has data for this month with specific waste type
        records = WasteRecord.objects.filter(date=date, waste_type=waste_type)
        has_data = records.exists()

        # Count departments with data
        dept_count = records.values('department').distinct().count() if has_data else 0

        status[date] = {
            'has_data': has_data,
            'department_count': dept_count
        }

    return JsonResponse({'success': True, 'status': status})


@require_http_methods(["GET"])
@permission_required("registrar")
def get_department_data(request):
    """Get department data for specific month"""
    year = request.GET.get('year')
    month = request.GET.get('month')
    waste_type_id = request.GET.get('waste_type_id')

    if not year or not month:
        return JsonResponse({'success': False, 'error': '缺少年份或月份參數'})

    date = f"{year}-{month.zfill(2)}"

    # Get waste type - use provided or default
    if waste_type_id:
        try:
            waste_type = WasteType.objects.get(id=waste_type_id, is_active=True)
        except WasteType.DoesNotExist:
            return JsonResponse({'success': False, 'error': '指定的廢棄物種類不存在'})
    else:
        waste_type = DepartmentWasteConfiguration.get_default_waste_type()
        if not waste_type:
            return JsonResponse({'success': False, 'error': '請指定廢棄物種類 ID，系統未設定預設廢棄物種類'})

    # Get all active departments
    mapped_departments = Department.objects.filter(
        is_active=True
    ).order_by('display_order', 'name')

    # Get existing records for this month
    existing_records = {
        record.department_id: record
        for record in WasteRecord.objects.filter(
            date=date,
            waste_type=waste_type
        ).select_related('department')
    }

    # Build department data - ONLY show departments mapped to this waste type
    departments_data = []
    for dept in mapped_departments:
        record = existing_records.get(dept.id)
        departments_data.append({
            'id': dept.id,
            'name': dept.name,
            'amount': record.amount if record else None,
            'unit': waste_type.unit,
            'has_data': record is not None
        })

    return JsonResponse({
        'success': True,
        'date': date,
        'departments': departments_data
    })


@csrf_protect
@require_http_methods(["POST"])
@permission_required("registrar")
def save_department_data(request):
    """Save single department waste data"""
    try:
        data = json.loads(request.body)
        department_id = data.get('department_id')
        date = data.get('date')
        amount = data.get('amount')
        waste_type_id = data.get('waste_type_id')

        if not department_id or not date:
            return JsonResponse({'success': False, 'error': '缺少必要參數'})

        # Validate date format
        is_valid, error_msg = validate_yyyy_mm_format(date)
        if not is_valid:
            return JsonResponse({'success': False, 'error': error_msg})

        # Get department and waste type
        try:
            department = Department.objects.get(id=department_id, is_active=True)
        except Department.DoesNotExist:
            return JsonResponse({'success': False, 'error': '部門不存在'})

        # Get waste type - use provided or default
        if waste_type_id:
            try:
                waste_type = WasteType.objects.get(id=waste_type_id, is_active=True)
            except WasteType.DoesNotExist:
                return JsonResponse({'success': False, 'error': '指定的廢棄物種類不存在'})
        else:
            waste_type = DepartmentWasteConfiguration.get_default_waste_type()
            if not waste_type:
                return JsonResponse({'success': False, 'error': '請指定廢棄物種類 ID，系統未設定預設廢棄物種類'})

        # Validate amount
        if amount is not None and amount != '':
            try:
                amount = float(amount)
                if amount < 0:
                    return JsonResponse({'success': False, 'error': '數量不能為負數'})
            except ValueError:
                return JsonResponse({'success': False, 'error': '無效的數量格式'})
        else:
            amount = None

        with transaction.atomic():
            # Update or create record
            record, created = WasteRecord.objects.update_or_create(
                date=date,
                department=department,
                waste_type=waste_type,
                defaults={'amount': amount}
            )

        return JsonResponse({
            'success': True,
            'created': created,
            'record': {
                'department_id': department.id,
                'department_name': department.name,
                'amount': record.amount,
                'date': date
            }
        })

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': '無效的JSON資料'})
    except Exception as e:
        logger.error(f"Save department data error: {str(e)}", exc_info=True)
        return JsonResponse({'success': False, 'error': f'儲存失敗: {str(e)}'})


@csrf_protect
@require_http_methods(["POST"])
@permission_required("registrar")
def delete_department_data(request):
    """Delete department waste data for specific date range"""
    try:
        data = json.loads(request.body)
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        department_ids = data.get('department_ids', [])
        waste_type_id = data.get('waste_type_id')

        if not start_date or not end_date:
            return JsonResponse({'success': False, 'error': '缺少日期範圍'})

        # Build query
        query_filters = {
            'date__gte': start_date,
            'date__lte': end_date
        }

        if department_ids:
            query_filters['department_id__in'] = department_ids

        # Add waste_type filter if provided
        if waste_type_id:
            try:
                waste_type = WasteType.objects.get(id=waste_type_id, is_active=True)
                query_filters['waste_type'] = waste_type
            except WasteType.DoesNotExist:
                return JsonResponse({'success': False, 'error': '指定的廢棄物種類不存在'})

        # Delete records
        deleted_count = WasteRecord.objects.filter(**query_filters).delete()[0]

        return JsonResponse({'success': True, 'deleted_count': deleted_count})

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': '無效的JSON資料'})
    except Exception as e:
        logger.error(f"Delete department data error: {str(e)}", exc_info=True)
        return JsonResponse({'success': False, 'error': f'刪除失敗: {str(e)}'})


@csrf_protect
@require_http_methods(["POST"])
@permission_required("registrar")
def batch_import_departments(request):
    """Handle batch import of department waste data - OPTIMIZED VERSION"""
    if request.method != "POST":
        return JsonResponse({"success": False, "error": "無效請求方法"})

    try:
        data = json.loads(request.body.decode('utf-8'))
        rows = data.get("rows", [])
        override_conflicts = data.get("override_conflicts", False)
        waste_type_id = data.get("waste_type_id")

        if not rows:
            return JsonResponse({"success": False, "error": "未提供資料"})

        # Security check: Verify override permission
        if override_conflicts:
            from MedicalWasteManagementSystem.permissions import has_override_permission
            if not has_override_permission(request.user, 'management'):
                logger.warning(f"User {request.user.username} attempted override in batch_import_departments without permission")
                return JsonResponse({"success": False, "error": "您沒有覆寫資料的權限"})

        logger.info(f"Department batch import started: {len(rows)} rows, override={override_conflicts}")

        # Get configuration (query once, reuse for all rows)
        dept_mapping = DepartmentWasteConfiguration.get_department_mapping()

        # Determine target waste type based on frontend parameter
        if waste_type_id:
            try:
                target_waste_type = WasteType.objects.get(id=int(waste_type_id), is_active=True)
            except WasteType.DoesNotExist:
                return JsonResponse({"success": False, "error": "指定的廢棄物種類不存在"})
        else:
            # Fallback to default waste type if not provided
            target_waste_type = DepartmentWasteConfiguration.get_default_waste_type()
            if not target_waste_type:
                try:
                    target_waste_type = WasteType.objects.filter(is_active=True).first()
                except Exception:
                    pass

        if not target_waste_type:
            return JsonResponse({
                "success": False,
                "error": "系統中沒有可用的廢棄物種類，請先在管理界面建立廢棄物種類後再進行匯入"
            })

        # Results container
        results = {
            "total": len(rows),
            "success": 0,
            "failed": [],
            "conflicts": []
        }

        # ===== OPTIMIZATION: Preload all existing records (1 query) =====
        all_dates = [row.get("date") for row in rows]
        all_dates = [d for d in all_dates if d]  # Remove None/empty

        existing_records_data = WasteRecord.objects.filter(
            date__in=all_dates,
            waste_type=target_waste_type
        ).values('date', 'department_id', 'amount')

        # Build conflict map: key = (date, department_id), value = existing_amount
        conflict_map = {
            (record['date'], record['department_id']): record['amount']
            for record in existing_records_data
        }

        logger.debug(f"Preloaded {len(conflict_map)} existing records")

        # ===== OPTIMIZATION: Process all rows with O(1) conflict detection =====
        records_to_create = []
        records_to_update = []

        for idx, row in enumerate(rows):
            date = row.get("date")

            # Validate date format
            is_valid, error_msg = validate_yyyy_mm_format(date)
            if not is_valid:
                results["failed"].append({
                    "index": idx,
                    "reason": error_msg,
                    "data": row
                })
                continue

            # Process department data in this row
            row_conflicts = []
            row_operations = []

            for dept_name, amount_str in row.items():
                if dept_name == "date" or not amount_str or amount_str.strip() == '':
                    continue

                # Check if department exists
                if dept_name not in dept_mapping:
                    results["failed"].append({
                        "index": idx,
                        "reason": f"未知部門: {dept_name}",
                        "data": row
                    })
                    continue

                # Parse amount
                try:
                    amount = float(amount_str)
                    if amount < 0:
                        results["failed"].append({
                            "index": idx,
                            "reason": f"部門 {dept_name} 數量不能為負數",
                            "data": row
                        })
                        continue
                except ValueError:
                    results["failed"].append({
                        "index": idx,
                        "reason": f"部門 {dept_name} 數量格式無效",
                        "data": row
                    })
                    continue

                department_id = dept_mapping[dept_name]

                # O(1) conflict check using hash map
                conflict_key = (date, department_id)
                existing_amount = conflict_map.get(conflict_key)

                if existing_amount is not None and not override_conflicts:
                    # Conflict found
                    row_conflicts.append({
                        "department": dept_name,
                        "existing_amount": existing_amount,
                        "new_amount": amount
                    })
                else:
                    # No conflict or override mode
                    row_operations.append({
                        "date": date,
                        "department_id": department_id,
                        "department_name": dept_name,
                        "amount": amount,
                        "exists": existing_amount is not None
                    })

            # Handle row-level conflicts or collect operations
            if row_conflicts:
                # If there are conflicts, do NOT write any data for this month
                results["conflicts"].append({
                    "index": idx,
                    "date": date,
                    "conflicts": row_conflicts,
                    "data": row
                })
            else:
                # No conflicts - collect all operations for batch processing
                for op in row_operations:
                    if op["exists"]:
                        # Update existing record
                        records_to_update.append(op)
                    else:
                        # Create new record
                        records_to_create.append(WasteRecord(
                            date=op["date"],
                            department_id=op["department_id"],
                            waste_type=target_waste_type,
                            amount=op["amount"]
                        ))

        # ===== OPTIMIZATION: Bulk create all new records =====
        if records_to_create:
            try:
                with transaction.atomic():
                    WasteRecord.objects.bulk_create(records_to_create, batch_size=100)
                    results["success"] += len(records_to_create)
                    logger.debug(f"Bulk created {len(records_to_create)} records")
            except Exception as e:
                logger.error(f"Bulk create failed: {str(e)}", exc_info=True)
                # Fallback to individual creates if bulk fails
                for record in records_to_create:
                    try:
                        record.save()
                        results["success"] += 1
                    except Exception as e2:
                        results["failed"].append({
                            "reason": f"建立失敗: {str(e2)}"
                        })

        # ===== OPTIMIZATION: Bulk update using delete + create strategy =====
        if records_to_update:
            try:
                with transaction.atomic():
                    # Build combined delete filter
                    delete_filters = []
                    for op in records_to_update:
                        delete_filters.append(
                            Q(date=op["date"], department_id=op["department_id"], waste_type=target_waste_type)
                        )

                    if delete_filters:
                        combined_filter = delete_filters[0]
                        for f in delete_filters[1:]:
                            combined_filter |= f

                        deleted_count = WasteRecord.objects.filter(combined_filter).delete()[0]
                        logger.debug(f"Deleted {deleted_count} existing records for update")

                    # Bulk create all updated records
                    updated_records = [
                        WasteRecord(
                            date=op["date"],
                            department_id=op["department_id"],
                            waste_type=target_waste_type,
                            amount=op["amount"]
                        )
                        for op in records_to_update
                    ]

                    WasteRecord.objects.bulk_create(updated_records, batch_size=100)
                    results["success"] += len(records_to_update)
                    logger.debug(f"Bulk updated {len(records_to_update)} records via delete+create")
            except Exception as e:
                logger.error(f"Bulk update failed: {str(e)}", exc_info=True)
                # Fallback to individual updates
                for op in records_to_update:
                    try:
                        with transaction.atomic():
                            WasteRecord.objects.filter(
                                date=op["date"],
                                department_id=op["department_id"],
                                waste_type=target_waste_type
                            ).delete()
                            WasteRecord.objects.create(
                                date=op["date"],
                                department_id=op["department_id"],
                                waste_type=target_waste_type,
                                amount=op["amount"]
                            )
                            results["success"] += 1
                    except Exception as e2:
                        results["failed"].append({
                            "reason": f"部門 {op['department_name']} 更新失敗: {str(e2)}"
                        })

        logger.info(f"Department batch import completed: {results['success']} success, {len(results['failed'])} failed, {len(results['conflicts'])} conflicts")

        # Check if we have unresolved conflicts
        if results["conflicts"] and not override_conflicts:
            return JsonResponse({
                "success": False,
                "error": "資料衝突",
                "results": results
            })

        return JsonResponse({"success": True, "results": results})

    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "無效的JSON資料"})
    except Exception as e:
        logger.error(f"批次匯入錯誤: {str(e)}", exc_info=True)
        return JsonResponse({"success": False, "error": f"伺服器錯誤: {str(e)}"})


@require_http_methods(["GET"])
@permission_required("registrar")
def export_department_data(request):
    """Export department data to Excel"""
    try:
        year = request.GET.get('year')
        month = request.GET.get('month')
        format_type = request.GET.get('format', 'excel')

        if not year:
            return JsonResponse({'success': False, 'error': '缺少年份參數'})

        if format_type == 'excel':
            from .utils import DepartmentDataExporter
            return DepartmentDataExporter.export_to_csv(int(year), int(month) if month else None)
        else:
            return JsonResponse({'success': False, 'error': '不支援的匯出格式'})

    except Exception as e:
        logger.error(f"Export error: {str(e)}", exc_info=True)
        return JsonResponse({'success': False, 'error': f'匯出失敗: {str(e)}'})

@ensure_csrf_cookie
def visualize_department_index(request):
    """Department waste visualization main page"""
    return render(request, 'management/vis-department.html')


def visualize_department_config(request):
    """Department visualization configuration API - provides waste types and department lists"""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'error': '只支援GET請求'})
    
    try:
        from .models import WasteType, Department
        
        # Get all active waste types
        waste_types = []
        for wt in WasteType.objects.filter(is_active=True).order_by('name'):
            waste_types.append({
                'id': wt.id,
                'name': wt.name,
                'unit': wt.unit
            })
        
        # Get all active departments
        departments = []
        for dept in Department.objects.filter(is_active=True).order_by('display_order', 'name'):
            departments.append({
                'id': dept.id,
                'name': dept.name,
                'display_order': dept.display_order
            })
        
        # Y-axis options with unit mapping
        y_axis_options = [
            {'value': 'metric_ton', 'label': '以重量劃分 - 公噸'},
            {'value': 'kilogram', 'label': '以重量劃分 - 公斤'}
        ]
        
        # X-axis time options
        x_axis_options = [
            {'value': 'year_sum', 'label': '以年份劃分 - 總和'},
            {'value': 'year_avg', 'label': '以年份劃分 - 平均'},
            {'value': 'quarter_sum', 'label': '以季度劃分 - 總和'},
            {'value': 'quarter_avg', 'label': '以季度劃分 - 平均'},
            {'value': 'month', 'label': '以月份劃分'}
        ]
        
        # Ranking options
        ranking_options = [
            {'value': 'most', 'label': '最多'},
            {'value': 'least', 'label': '最少'}
        ]
        
        return JsonResponse({
            'success': True,
            'waste_types': waste_types,
            'departments': departments,
            'y_axis_options': y_axis_options,
            'x_axis_options': x_axis_options,
            'ranking_options': ranking_options
        })
        
    except Exception as e:
        logger.error(f"Department visualization config error: {str(e)}", exc_info=True)
        return JsonResponse({'success': False, 'error': f'配置載入失敗: {str(e)}'})


def visualize_department_data(request):
    """Department waste visualization data API - returns department ranking data by waste type"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': '只支援POST請求'})
    
    try:
        from django.db.models import Sum, Avg
        from .models import WasteRecord, WasteType, Department
        
        data = json.loads(request.body)
        
        # Parameter validation
        required_fields = ['y_axis', 'x_axis', 'display_type', 'datasets']
        for field in required_fields:
            if field not in data:
                return JsonResponse({'success': False, 'error': f'缺少必要參數: {field}'})
        
        y_axis = data['y_axis']
        x_axis = data['x_axis']
        display_type = data['display_type']
        datasets = data['datasets']
        title = data.get('title', '部門廢棄物分析')
        show_values = data.get('show_values', False)
        
        if not datasets:
            return JsonResponse({'success': False, 'error': '至少需要一個資料集'})
        
        # Process each dataset (department ranking by waste type)
        all_series = []
        all_labels = []  # Collect all department labels
        department_priority = {}  # Department priority mapping
        priority_counter = 0
        
        for dataset in datasets:
            try:
                # Validate dataset parameters
                required_dataset_fields = ['waste_type_id', 'start_date', 'end_date', 'ranking_type', 'ranking_count', 'name', 'color']
                for field in required_dataset_fields:
                    if field not in dataset:
                        return JsonResponse({'success': False, 'error': f'資料集缺少必要參數: {field}'})
                
                waste_type_id = dataset['waste_type_id']
                start_date = dataset['start_date']
                end_date = dataset['end_date']
                ranking_type = dataset['ranking_type']  # 'most' or 'least'
                ranking_count = int(dataset['ranking_count'])
                series_name = dataset['name']
                series_color = dataset['color']
                
                # Get waste type information
                try:
                    waste_type = WasteType.objects.get(id=waste_type_id, is_active=True)
                except WasteType.DoesNotExist:
                    return JsonResponse({'success': False, 'error': f'廢棄物類型 {waste_type_id} 不存在或未啟用'})
                
                # Determine aggregation method based on time unit
                if x_axis.startswith('year'):
                    # Year aggregation
                    start_year = start_date
                    end_year = end_date
                    date_filter = {
                        'date__gte': f'{start_year}-01',
                        'date__lte': f'{end_year}-12'
                    }
                    if x_axis == 'year_sum':
                        aggregation = Sum('amount')
                    else:  # year_avg
                        aggregation = Avg('amount')
                elif x_axis.startswith('quarter'):
                    # Quarter aggregation (simplified implementation using yearly data)
                    start_year = start_date
                    end_year = end_date
                    date_filter = {
                        'date__gte': f'{start_year}-01',
                        'date__lte': f'{end_year}-12'
                    }
                    if x_axis == 'quarter_sum':
                        aggregation = Sum('amount')
                    else:  # quarter_avg
                        aggregation = Avg('amount')
                else:  # month
                    date_filter = {
                        'date__gte': start_date + '-01',
                        'date__lte': end_date + '-01'
                    }
                    aggregation = Sum('amount')
                
                # Query department statistics
                department_stats = WasteRecord.objects.filter(
                    waste_type_id=waste_type_id,
                    **date_filter
                ).values('department__id', 'department__name').annotate(
                    total_amount=aggregation
                ).filter(total_amount__isnull=False)
                
                # Sort and limit departments based on ranking_count
                if ranking_type == 'most':
                    department_stats = department_stats.order_by('-total_amount')
                else:  # least
                    department_stats = department_stats.order_by('total_amount')

                # Limit results to ranking_count (top/bottom N items)
                # This ensures only the specified number of departments are displayed
                department_stats = department_stats[:ranking_count]
                
                # Process unit conversion
                series_data = []
                department_labels = []  # Full department names (no truncation)

                for stat in department_stats:
                    dept_name = stat['department__name']
                    amount = stat['total_amount'] or 0

                    # Unit conversion
                    if y_axis == 'metric_ton' and waste_type.unit == 'kilogram':
                        amount = amount / 1000  # kg to metric ton
                    elif y_axis == 'kilogram' and waste_type.unit == 'metric_ton':
                        amount = amount * 1000  # metric ton to kg

                    series_data.append(amount)
                    # Keep full department names - no truncation in backend
                    department_labels.append(dept_name)

                    # Record department priority (for priority display)
                    if dept_name not in department_priority:
                        department_priority[dept_name] = priority_counter
                        priority_counter += 1
                
                # Add to results
                all_series.append({
                    'name': series_name,
                    'data': series_data,
                    'labels': department_labels,  # Full department names (no truncation)
                    'color': series_color,
                    'waste_type': waste_type.name,
                    'unit': y_axis
                })

                # Collect all department labels (full names)
                all_labels.extend(department_labels)
                
            except Exception as e:
                logger.error(f"Dataset processing error: {str(e)}", exc_info=True)
                return JsonResponse({'success': False, 'error': f'處理資料集失敗: {str(e)}'})
        
        # Process final output based on display method
        if display_type == 'separate':
            # By priority - rearrange all departments using full names for sorting
            unique_departments = list(set(all_labels))
            # Sort by priority using department names (earlier appearance has higher priority)
            unique_departments.sort(key=lambda x: department_priority.get(x, 999))

            # Reorganize data: create complete data arrays for each series
            final_series = []
            for series in all_series:
                full_data = []
                for dept in unique_departments:
                    if dept in series['labels']:
                        idx = series['labels'].index(dept)
                        full_data.append(series['data'][idx])
                    else:
                        full_data.append(0)  # No data for this department in this series

                final_series.append({
                    'name': series['name'],
                    'data': full_data,
                    'color': series['color']
                })

            result_labels = unique_departments
        else:
            # Combine - show all series but order departments by total sum
            department_totals = {}
            unique_departments = list(set(all_labels))
            
            # Calculate total for each department across all series
            for dept in unique_departments:
                department_totals[dept] = 0
                for series in all_series:
                    if dept in series['labels']:
                        idx = series['labels'].index(dept)
                        department_totals[dept] += series['data'][idx]
            
            # Sort departments by total (highest first)
            sorted_depts = sorted(department_totals.items(), key=lambda x: x[1], reverse=True)
            result_labels = [dept for dept, _ in sorted_depts]
            
            # Create series for each original series, but reorganized by combined total
            final_series = []
            for series in all_series:
                full_data = []
                for dept in result_labels:
                    if dept in series['labels']:
                        idx = series['labels'].index(dept)
                        full_data.append(series['data'][idx])
                    else:
                        full_data.append(0)  # No data for this department in this series
                
                final_series.append({
                    'name': series['name'],
                    'data': full_data,
                    'color': series['color']
                })
        
        # Determine Y-axis unit
        y_axis_unit = ''
        if y_axis == 'metric_ton':
            y_axis_unit = '公噸'
        elif y_axis == 'kilogram':
            y_axis_unit = '公斤'
        elif y_axis == 'new_taiwan_dollar':
            y_axis_unit = '新台幣'

        return JsonResponse({
            'success': True,
            'chart_type': 'bar',  # Department analysis defaults to bar chart
            'x_axis_labels': result_labels,
            'series': final_series,
            'title': title,
            'show_values': show_values,
            'y_axis': y_axis,
            'y_axis_unit': y_axis_unit
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': '無效的JSON格式'})
    except Exception as e:
        logger.error(f"Department visualization data error: {str(e)}", exc_info=True)
        return JsonResponse({'success': False, 'error': f'資料處理失敗: {str(e)}'})