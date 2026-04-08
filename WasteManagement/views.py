import json
import logging
import random
import time
from datetime import datetime, timedelta

from django.contrib import messages
from django.db import transaction, models
from django.db.models import Q, Sum, Count, Avg, F
from django.http import JsonResponse
from django.core.paginator import Paginator
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_POST, require_GET
from django.utils import timezone
from dateutil.relativedelta import relativedelta

from Main.models import UserProfile
from MedicalWasteManagementSystem.permissions import *
from MedicalWasteManagementSystem.date_validators import validate_yyyy_mm_format
from WasteManagement.models import *
from .visualization_service import VisualizeDataService, VisualizeRequestValidator

logger = logging.getLogger(__name__)

# =========================================================
# 1. 核心工具與模型配置
# =========================================================

TABLE_MAPPING = {
    "general_waste_production": GeneralWasteProduction,
    "biomedical_waste_production": BiomedicalWasteProduction,
    "dialysis_bucket_soft_bag_production_and_disposal_costs": DialysisBucketSoftBagProductionAndDisposalCosts,
    "pharmaceutical_glass_production_and_disposal_costs": PharmaceuticalGlassProductionAndDisposalCosts,
    "paper_iron_aluminum_can_plastic_and_glass_production_and_recycling_revenue": PaperIronAluminumCanPlasticAndGlassProductionAndRecyclingRevenue
}

def get_model_info(table_name):
    model = TABLE_MAPPING.get(table_name)
    if not model: return None, [], {}
    if table_name == 'general_waste_production' and hasattr(model, 'get_field_config'):
        config = model.get_field_config()
        fields_config = config.get('fields', {})
        all_model_fields = [f.name for f in model._meta.fields if f.name != 'date']
        visible_fields = [fn for fn in all_model_fields if fn in fields_config and fields_config[fn].get('visible', False)]
        if 'total' in all_model_fields: visible_fields.append('total')
        return model, visible_fields, {fn: fields_config[fn] for fn in visible_fields if fn in fields_config}
    fields = [f.name for f in model._meta.fields if f.name != 'date']
    return model, fields, getattr(model, 'FIELD_INFO', {})

# =========================================================
# 2. 資料庫管理 UI (解決 AttributeError: get_data)
# =========================================================

@ensure_csrf_cookie
@permission_required("registrar")
def database_index(request):
    table_name = request.POST.get("table") or request.GET.get("table", "general_waste_production")
    model, fields, field_info = get_model_info(table_name)
    start_date = request.POST.get("start_date", ""); end_date = request.POST.get("end_date", "")
    edit_date = request.POST.get("edit_date") if request.method == "POST" and request.POST.get("action") in ["edit", "save"] else None
    adding = request.method == "POST" and request.POST.get("action") == "add"
    error = None

    if request.method == "POST" and not request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        action = request.POST.get("action")
        if action == "save":
            date = request.POST.get("new_date") or request.POST.get("edit_date")
            is_valid, error_msg = validate_yyyy_mm_format(date)
            if not is_valid: error = error_msg
            elif model.objects.filter(date=date).exists() and date != request.POST.get("edit_date", ""):
                error = f"日期 {date} 已存在"; edit_date = request.POST.get("edit_date")
                if not edit_date: adding = True
            else:
                defaults = {}
                for field in fields:
                    if field == 'total': continue
                    val = request.POST.get(f"new_{field}") or request.POST.get(f"edit_{field}")
                    if val: defaults[field] = float(val) if isinstance(model._meta.get_field(field), models.FloatField) else int(val)
                    elif val == "": defaults[field] = None
                model.objects.update_or_create(date=date, defaults=defaults)
                adding = False; edit_date = None

    data = list(model.objects.filter(Q(date__gte=start_date) if start_date else Q(), Q(date__lte=end_date) if end_date else Q()).order_by('date').values("date", *fields)) if model else []
    return render(request, 'management/database.html', {
        "data": data, "fields": list(fields), "field_info": field_info, "selected_table": table_name,
        "start_date": start_date, "end_date": end_date, "edit_date": edit_date, "adding": adding, "error": error
    })

@require_GET
@login_required
def get_data(request):
    """API: 獲取單筆資料庫紀錄"""
    table_name = request.GET.get("table"); date = request.GET.get("date")
    model, fields, _ = get_model_info(table_name)
    if not model or not date: return JsonResponse({"success": False, "error": "參數錯誤"})
    record = model.objects.filter(date=date).values("date", *fields).first()
    return JsonResponse(record if record else {"success": False, "error": "資料不存在"})

@require_POST
@login_required
def save_data(request):
    """API: 儲存單筆資料庫紀錄"""
    try:
        data = json.loads(request.body); table_name = data.get("table")
        model, fields, _ = get_model_info(table_name)
        date = data.get("date"); defaults = {f: data.get(f) for f in fields if f in data and f != 'total'}
        model.objects.update_or_create(date=date, defaults=defaults)
        return JsonResponse({"success": True})
    except Exception as e: return JsonResponse({"success": False, "error": str(e)})

@require_POST
@login_required
def delete_data(request):
    """API: 刪除資料庫紀錄"""
    try:
        data = json.loads(request.body); model, _, _ = get_model_info(data.get("table"))
        model.objects.filter(date__in=data.get("dates", [])).delete()
        return JsonResponse({"success": True})
    except Exception as e: return JsonResponse({"success": False, "error": str(e)})

# =========================================================
# 3. 🌟 廢棄物結算與高品質模擬資料 (修復 AttributeError) 🌟
# =========================================================

@login_required
def settlement_view(request):
    """
    結算頁面：從資料庫讀取真實紀錄，並支援 AJAX 局部更新
    """
    # 1. 取得篩選參數
    f_start = request.GET.get('start_date', '')
    f_end = request.GET.get('end_date', '')
    f_waste_type = request.GET.get('waste_type', '')
    f_location = request.GET.get('location', '')
    f_dept = request.GET.get('dept', '')
    f_weigher = request.GET.get('weigher', '')
    f_sort = request.GET.get('sort_by', 'newest')
    f_size = int(request.GET.get('page_size', 10))

    # 2. 準備下拉選單資料
    departments_list = Department.objects.all()
    locations_list = LocationPoint.objects.all()
    weighers_list = UserProfile.objects.all()
    waste_types_list = WasteType.objects.all()

    # 3. 🌟 建立真實資料庫查詢條件 (對應 WasteRecord_New) 🌟
    query = Q()
    if f_start:
        query &= Q(create_time__date__gte=f_start)
    if f_end:
        query &= Q(create_time__date__lte=f_end)
    if f_waste_type:
        query &= Q(waste_type_id=f_waste_type)
    if f_location:
        query &= Q(location_id=f_location)
    if f_dept:
        query &= Q(department_id=f_dept)
    if f_weigher:
        profile = UserProfile.objects.filter(id=f_weigher).first()
        if profile:
            query &= Q(creator=profile.user)

    # 執行查詢 (這裡就是精準去抓 WasteRecord_New)
    records_queryset = WasteRecord_New.objects.filter(query).select_related('department', 'location', 'waste_type', 'creator')

    # 4. 排序
    sort_mapping = {
        'newest': '-create_time',
        'oldest': 'create_time',
        'weight_desc': '-weight',
        'weight_asc': 'weight',
    }
    records_queryset = records_queryset.order_by(sort_mapping.get(f_sort, '-create_time'))

    # 5. 分頁
    paginator = Paginator(records_queryset, f_size)
    page_obj = paginator.get_page(request.GET.get('page', 1))

    # 6. 準備統計 JSON (供前端 AJAX 更新四格卡片)
    all_records = list(records_queryset.all())
    total_w = sum(r.weight for r in all_records) if all_records else 0
    
    all_data_json = []
    for r in all_records:
        creator_display = r.creator.username
        if hasattr(r.creator, 'profile') and r.creator.profile:
            creator_display = str(r.creator.profile)

        all_data_json.append({
            'weight': float(r.weight),
            'status': '已載運' if r.is_transported else '未載運',
            'waste_type': r.waste_type.name if r.waste_type else '未知',
            'department': r.department.name if r.department else '未知',
            'location': r.location.name if r.location else '未知',
            'creator': creator_display,
            'create_time': r.create_time.strftime('%Y-%m-%d %H:%M')
        })

    context = {
        'page_obj': page_obj, 
        'current_page_size': f_size, 
        'current_sort': f_sort,
        'start_date': f_start, 
        'end_date': f_end,
        'selected_waste_type': f_waste_type, 
        'selected_location': f_location,
        'selected_dept': f_dept, 
        'selected_weigher': f_weigher,
        'departments': departments_list, 
        'locations': locations_list, 
        'weighers': weighers_list,
        'waste_types': waste_types_list, 
        'process_agencies': processAgency.objects.all(), 
        'clear_agencies': clearAgency.objects.all(),
        'all_filtered_data': json.dumps(all_data_json, ensure_ascii=False),
        'total_weight_sum': total_w,
    }

    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return render(request, 'management/settlement_table_content.html', context)
    return render(request, 'management/settlement_fragment.html', context)

# =========================================================
# 4. 載運紀錄管理
# =========================================================

@login_required
def transportation_view(request):
    f_start = request.GET.get('start_date', '')
    f_end = request.GET.get('end_date', '')
    f_agency = request.GET.get('agency', '')
    f_sort = request.GET.get('sort_by', 'newest')
    f_size = int(request.GET.get('page_size', 10))

    query = Q()
    if f_start: query &= Q(settle_time__date__gte=f_start)
    if f_end: query &= Q(settle_time__date__lte=f_end)
    if f_agency:
        if f_agency.startswith('clear_'): query &= Q(clear_agency_id=f_agency.split('_')[1])
        elif f_agency.startswith('process_'): query &= Q(process_agency_id=f_agency.split('_')[1])

    batches = TransportRecord.objects.filter(query)
    
    # 🌟 修正處 1：排序時使用正確的關聯名稱 wasterecord_new 🌟
    if f_sort == 'newest': batches = batches.order_by('-settle_time')
    elif f_sort == 'oldest': batches = batches.order_by('settle_time')
    elif f_sort == 'weight_desc': batches = batches.annotate(total_w=Sum('wasterecord_new__weight')).order_by('-total_w')
    elif f_sort == 'weight_asc': batches = batches.annotate(total_w=Sum('wasterecord_new__weight')).order_by('total_w')
    
    # 🌟 修正處 2：計算總重量時使用正確的關聯名稱 wasterecord_new 🌟
    total_weight_sum = batches.aggregate(total=Sum('wasterecord_new__weight'))['total'] or 0

    paginator = Paginator(batches, f_size)
    page_obj = paginator.get_page(request.GET.get('page', 1))

    context = {
        'page_obj': page_obj, 'current_page_size': f_size, 'current_sort': f_sort,
        'start_date': f_start, 'end_date': f_end, 'selected_agency': f_agency,
        'clear_agencies': clearAgency.objects.all(), 'process_agencies': processAgency.objects.all(),
        'total_weight_sum': total_weight_sum,
    }

    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return render(request, 'management/transportation_table_content.html', context)
    return render(request, 'management/transportation.html', context)

# =========================================================
# 5. 各類 API 與 部門管理
# =========================================================

@require_POST
@login_required
def settlement_process(request):
    ids_str = request.POST.get('selected_ids'); p_id = request.POST.get('process_agency'); c_id = request.POST.get('clear_agency')
    if ids_str and p_id and c_id:
        try:
            with transaction.atomic():
                new_transport = TransportRecord.objects.create(settler=request.user, process_agency_id=p_id, clear_agency_id=c_id)
                updated = WasteRecord_New.objects.filter(id__in=ids_str.split(',')).update(is_transported=True, transportrecord=new_transport)
                messages.success(request, f'成功結算 {updated} 筆資料！')
        except Exception as e: messages.error(request, f'結算失敗：{str(e)}')
    return redirect('WasteManagement:settlement_view')

@require_POST
@login_required
def delete_records_api(request):
    try:
        data = json.loads(request.body); ids = data.get('ids', [])
        WasteRecord_New.objects.filter(id__in=ids).delete()
        return JsonResponse({'status': 'success'})
    except Exception as e: return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

@require_POST
@login_required
def delete_batches_api(request):
    try:
        data = json.loads(request.body); ids = data.get('ids', [])
        WasteRecord_New.objects.filter(transportrecord_id__in=ids).update(is_transported=False, transportrecord=None)
        TransportRecord.objects.filter(id__in=ids).delete()
        return JsonResponse({'status': 'success'})
    except Exception as e: return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

@ensure_csrf_cookie
@permission_required("registrar")
def db_department_index(request):
    config = DepartmentWasteConfiguration.get_configuration_data()
    return render(request, 'management/db-department.html', config)

@require_POST
def batch_import_departments(request):
    try:
        data = json.loads(request.body.decode('utf-8')); rows = data.get("rows", [])
        dept_mapping = DepartmentWasteConfiguration.get_department_mapping()
        target_wt = WasteType.objects.filter(is_active=True).first()
        all_dates = [r.get("date") for r in rows if r.get("date")]
        conflict_map = {(rec.date, rec.department_id): rec.amount for rec in WasteRecord.objects.filter(date__in=all_dates, waste_type=target_wt)}
        records_to_create = []
        for row in rows:
            date = row.get("date")
            for d_name, amt in row.items():
                if d_name == "date" or not amt: continue
                d_id = dept_mapping.get(d_name)
                if d_id and (date, d_id) not in conflict_map:
                    records_to_create.append(WasteRecord(date=date, department_id=d_id, waste_type=target_wt, amount=float(amt)))
        with transaction.atomic(): WasteRecord.objects.bulk_create(records_to_create, batch_size=100)
        return JsonResponse({"success": True, "results": {"success": len(records_to_create)}})
    except Exception as e: return JsonResponse({"success": False, "error": str(e)})

# =========================================================
# 6. 視覺化報表
# =========================================================

@ensure_csrf_cookie
def visualize_index(request):
    if request.method == 'GET':
        fields, table_names = {}, {}
        for table_name in TABLE_MAPPING.keys():
            model, _, f_info = get_model_info(table_name)
            if model: fields[table_name] = f_info; table_names[table_name] = model._meta.verbose_name
        return render(request, 'management/visualize.html', {'fields': json.dumps(fields, ensure_ascii=False), 'table_names': json.dumps(table_names, ensure_ascii=False)})
    
    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            is_valid, error_msg, cleaned_data = VisualizeRequestValidator.validate_chart_request(data)
            if not is_valid: return JsonResponse({'success': False, 'error': error_msg})
            chart_type = cleaned_data['chart_type']; y_axis = cleaned_data['y_axis']
            x_axis = cleaned_data['x_axis']; datasets = cleaned_data['datasets']
            all_starts = [d['start_date'][:7] for d in datasets]; all_ends = [d['end_date'][:7] for d in datasets]
            global_labels = generate_date_range(min(all_starts), max(all_ends))
            chart_data = []
            for ds in datasets:
                model_class, _, field_info = get_model_info(ds.get('table'))
                row_data = VisualizeDataService.get_optimized_data(model_class, field_info, y_axis, ds.get('start_date'), ds.get('end_date'), x_axis, ds.get('field'), {})
                chart_data.append({'name': ds.get('name'), 'data': row_data['data'], 'color': ds.get('color', '#2185d0')})
            return JsonResponse({'success': True, 'chart_type': chart_type, 'x_axis_labels': global_labels, 'series': chart_data})
        except Exception as e: return JsonResponse({'success': False, 'error': str(e)})

# =========================================================
# 7. 輔助功能與 API
# =========================================================

@login_required
def alert_record_view(request):
    all_alerts = WasteRecord_New.objects.filter(weight__gt=50).order_by('-create_time')
    paginator = Paginator(all_alerts, 10)
    return render(request, 'management/alert_record.html', {'page_obj': paginator.get_page(request.GET.get('page', 1)), 'weighers': UserProfile.objects.all(), 'current_page_size': 10, 'current_sort': 'newest'})

def mobile_station_view(request): return render(request, 'management/mobile/station.html', {'locations': list(LocationPoint.objects.values('id', 'name'))})
def qrcode_print_view(request): return render(request, 'management/qrcode_print.html', {'departments': Department.objects.all(), 'waste_types': WasteType.objects.all()})
@require_POST
@login_required
def record_waste_api(request):
    try:
        data = json.loads(request.body)
        WasteRecord_New.objects.create(location_id=data.get('location_id'), department=Department.objects.get(name=data.get('dept')), weight=data.get('weight'), waste_type=WasteType.objects.get(name=data.get('waste_type')), creator=request.user, updater=request.user)
        return JsonResponse({'status': 'success'})
    except Exception as e: return JsonResponse({'status': 'error', 'message': str(e)})

def location_management_view(request): return render(request, 'management/location_management.html', {})
def generate_date_range(start_str, end_str):
    start = datetime.strptime(start_str, '%Y-%m'); end = datetime.strptime(end_str, '%Y-%m')
    labels = []; curr = start
    while curr <= end: labels.append(curr.strftime('%Y-%m')); curr += relativedelta(months=1)
    return labels

@require_GET
def get_month_status(request): return JsonResponse({'success': True})
def get_department_data(request): return JsonResponse({'success': True})
def api_save_location(request): return JsonResponse({'success': True})
def api_delete_location(request): return JsonResponse({'success': True})
def api_save_agency(request): return JsonResponse({'success': True})
def api_delete_agency(request): return JsonResponse({'success': True})
def locations_api(request): return JsonResponse({'locations': []})
def api_delete_alert_records(request): return JsonResponse({'status': 'success'})
def visualize_department_index(request): return render(request, 'management/vis-department.html', {})
def visualize_department_config(request): return JsonResponse({'success': True})
def visualize_department_data(request): return JsonResponse({'success': True})
def export_department_data(request): return JsonResponse({'success': True})
def save_department_data(request): return JsonResponse({'success': True})
def delete_department_data(request): return JsonResponse({'success': True})
def batch_import(request): return JsonResponse({'success': True})
def get_server_time(request): return JsonResponse({'serverTime': datetime.now().isoformat()})