import json
import logging
from datetime import datetime, timedelta
from django.contrib import messages
from django.db import transaction, models
from django.db.models import Q, Sum, Count, Avg
from django.http import JsonResponse
from django.core.paginator import Paginator
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_POST, require_GET
from django.utils import timezone

from Main.models import UserProfile
from WasteManagement.models import *

logger = logging.getLogger(__name__)

# =========================================================
# 1. 核心工具：模型映射
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
    fields = [f.name for f in model._meta.fields if f.name != 'date']
    info = getattr(model, 'FIELD_INFO', {})
    return model, fields, info

# =========================================================
# 2. 過磅紀錄
# =========================================================
@login_required
def settlement_view(request):
    f_start = request.GET.get('start_date', '')
    f_end = request.GET.get('end_date', '')
    f_waste_type = request.GET.get('waste_type', '')
    f_dept = request.GET.get('dept', '')
    
    # 🌟 補上抓取「定點」與「人員」參數
    f_location = request.GET.get('location', '')
    f_weigher = request.GET.get('weigher', '')
    
    f_sort = request.GET.get('sort_by', 'newest')
    f_size = int(request.GET.get('page_size', 10))

    query = Q()
    if f_start: query &= Q(create_time__date__gte=f_start)
    if f_end: query &= Q(create_time__date__lte=f_end)
    if f_waste_type: query &= Q(waste_type_id=f_waste_type)
    if f_dept: query &= Q(department_id=f_dept)
    
    # 🌟 將這兩個條件加入資料庫的過濾器中
    if f_location: query &= Q(location_id=f_location)
    if f_weigher: query &= Q(creator_id=f_weigher)

    records = WasteRecord_New.objects.filter(query).select_related('department', 'location', 'waste_type', 'creator')
    
    sort_map = {'newest': '-create_time', 'oldest': 'create_time', 'weight_desc': '-weight', 'weight_asc': 'weight'}
    records = records.order_by(sort_map.get(f_sort, '-create_time'))

    all_data_list = []
    for r in records:
        all_data_list.append({
            'id': r.id,
            'weight': float(r.weight),
            'status': '已載運' if r.is_transported else '未載運',
            'waste_type': r.waste_type.name if r.waste_type else '',
            'department': r.department.name if r.department else '',
            'location': r.location.name if r.location else '',
            'creator': getattr(r.creator, 'username', '-'),
            'create_time': r.create_time.strftime('%Y-%m-%d %H:%M')
        })

    paginator = Paginator(records, f_size)
    page_obj = paginator.get_page(request.GET.get('page', 1))
    total_w = sum(item['weight'] for item in all_data_list)

    context = {
        'page_obj': page_obj, 'current_page_size': f_size, 'current_sort': f_sort,
        'start_date': f_start, 'end_date': f_end,
        'selected_waste_type': f_waste_type, 'selected_dept': f_dept,
        
        # 🌟 把它們傳回前端，這樣下拉選單才不會在查詢後跑掉！
        'selected_location': f_location,
        'selected_weigher': f_weigher,
        
        'departments': Department.objects.all(), 'locations': LocationPoint.objects.all(),
        'waste_types': WasteType.objects.all(), 'process_agencies': processAgency.objects.all(),
        'clear_agencies': clearAgency.objects.all(), 'weighers': UserProfile.objects.all(),
        'all_filtered_data': all_data_list, 
        'total_weight_sum': round(total_w, 3),
    }
    
    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return render(request, 'management/settlement_table_content.html', context)
    return render(request, 'management/settlement_fragment.html', context)

# =========================================================
# 3. 載運紀錄
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

    batches = TransportRecord.objects.filter(query).annotate(
        total_w=Sum('wasterecord_new__weight')
    ).select_related('clear_agency', 'process_agency', 'settler')

    sort_map = {'weight_desc': '-total_w', 'weight_asc': 'total_w', 'oldest': 'settle_time'}
    batches = batches.order_by(sort_map.get(f_sort, '-settle_time'))

    # 🌟 確保 JSON 統計資料正確傳遞
    transport_json = []
    for b in batches:
        transport_json.append({
            'id': b.id,
            'settle_time': b.settle_time.strftime('%Y-%m-%d %H:%M') if b.settle_time else '',
            'total_weight': float(b.total_w) if b.total_w else 0.0,
            'clear_agency': b.clear_agency.name if b.clear_agency else '-',
            'process_agency': b.process_agency.name if b.process_agency else '-',
            'settler': getattr(b.settler, 'username', '-') if b.settler else '-'
        })

    paginator = Paginator(batches, f_size)
    page_obj = paginator.get_page(request.GET.get('page', 1))
    
    context = {
        'page_obj': page_obj, 
        'all_filtered_data': transport_json, # 傳遞 list 給 json_script
        'clear_agencies': clearAgency.objects.all(), 
        'process_agencies': processAgency.objects.all(),
        'start_date': f_start, 'end_date': f_end,
        'current_page_size': f_size, 'current_sort': f_sort,
        'selected_agency': f_agency,
    }

    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return render(request, 'management/transportation_table_content.html', context)
    return render(request, 'management/transportation.html', context)

# =========================================================
# 4. 警報紀錄管理 (含假資料屬性與 AJAX 支援)
# =========================================================
@login_required
def alert_record_view(request):
    f_start = request.GET.get('start_date', '')
    f_end = request.GET.get('end_date', '')
    f_weigher = request.GET.get('weigher', '')
    f_sort = request.GET.get('sort_by', 'newest')
    f_size = int(request.GET.get('page_size', 10))

    query = Q(weight__gt=50) # 假設重量大於50為警報
    if f_start: query &= Q(create_time__date__gte=f_start)
    if f_end: query &= Q(create_time__date__lte=f_end)
    if f_weigher: query &= Q(creator_id=f_weigher)

    alerts = WasteRecord_New.objects.filter(query).select_related('creator')

    if f_sort == 'severity_desc': alerts = alerts.order_by('-weight')
    elif f_sort == 'severity_asc': alerts = alerts.order_by('weight')
    elif f_sort == 'oldest': alerts = alerts.order_by('create_time')
    else: alerts = alerts.order_by('-create_time')

    all_data_list = []
    for a in alerts:
        a.weigher = a.creator 
        a.alert_name = "重量異常"
        a.alert_type = "設備異常"
        a.severity = "High" if a.weight > 100 else "Warning"

        display_name = ''
        if a.creator:
            display_name = a.creator.get_full_name()
            if not display_name:
                display_name = a.creator.username

        all_data_list.append({
            'id': a.id,
            'create_time': a.create_time.strftime('%Y-%m-%d %H:%M') if a.create_time else '',
            'weigher': display_name or '未知',
            'alert_name': a.alert_name,
            'alert_type': a.alert_type,
            'severity': a.severity
        })

    paginator = Paginator(alerts, f_size)
    page_obj = paginator.get_page(request.GET.get('page', 1))

    context = {
        'page_obj': page_obj,
        'weighers': UserProfile.objects.all(),
        'all_filtered_data': all_data_list, # 傳遞 list 給 json_script
        'current_page_size': f_size, 'current_sort': f_sort,
        'start_date': f_start, 'end_date': f_end, 'selected_weigher': f_weigher,
    }
    
    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return render(request, 'management/alert_record_table_content.html', context)
    return render(request, 'management/alert_record.html', context)

# =========================================================
# 5. 手機行動站
# =========================================================
@login_required
def mobile_station_view(request):
    locs = list(LocationPoint.objects.values('id', 'name', 'code'))
    return render(request, 'management/mobile/station.html', {'locations': locs})

# =========================================================
# 6. 核心 API (結算、新增、刪除、警報刪除)
# =========================================================
@require_POST
@login_required
def settlement_process(request):
    ids_str = request.POST.get('selected_ids'); p_id = request.POST.get('process_agency'); c_id = request.POST.get('clear_agency')
    if ids_str and p_id and c_id:
        try:
            with transaction.atomic():
                batch = TransportRecord.objects.create(settler=request.user, process_agency_id=p_id, clear_agency_id=c_id)
                WasteRecord_New.objects.filter(id__in=ids_str.split(',')).update(is_transported=True, transportrecord=batch)
                messages.success(request, '結算成功！')
        except Exception as e: messages.error(request, str(e))
    return redirect('WasteManagement:settlement_view')

@require_POST
@login_required
def delete_records_api(request):
    try:
        data = json.loads(request.body); ids = data.get('ids', [])
        batches = TransportRecord.objects.filter(id__in=ids)
        with transaction.atomic():
            WasteRecord_New.objects.filter(transportrecord__in=batches).update(is_transported=False, transportrecord=None)
            batches.delete()
        return JsonResponse({'status': 'success'})
    except Exception as e: return JsonResponse({'status': 'error', 'message': str(e)})

@require_POST
@login_required
def record_waste_api(request):
    try:
        data = json.loads(request.body)
        WasteRecord_New.objects.create(
            location_id=data.get('location_id'), department=Department.objects.get(name=data.get('dept')),
            weight=data.get('weight'), waste_type=WasteType.objects.get(name=data.get('waste_type')), creator=request.user
        )
        return JsonResponse({'status': 'success'})
    except Exception as e: return JsonResponse({'status': 'error', 'message': str(e)})

@require_POST
@login_required
def api_delete_alert_records(request):
    try:
        data = json.loads(request.body)
        ids = data.get('ids', [])
        if ids: WasteRecord_New.objects.filter(id__in=ids).delete()
        return JsonResponse({'status': 'success'})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

# =========================================================
# 7. 部門與原始數據管理
# =========================================================
@login_required
def location_management_view(request):
    return render(request, 'management/location_management.html', {
        'locations': LocationPoint.objects.all(), 'clear_agencies': clearAgency.objects.all(), 'process_agencies': processAgency.objects.all()
    })

@login_required
def database_index(request): return render(request, 'management/database.html')

@require_POST
def delete_department_data(request):
    try:
        data = json.loads(request.body); start = data.get('start_date'); end = data.get('end_date')
        WasteRecord.objects.filter(date__gte=start, date__lte=end).delete()
        return JsonResponse({'success': True})
    except Exception as e: return JsonResponse({'success': False, 'error': str(e)})

@require_GET
def visualize_department_config(request):
    try:
        # 🌟 安全版，防止沒有 is_active/unit 報錯
        w_types = list(WasteType.objects.values('id', 'name'))
        depts = list(Department.objects.values('id', 'name'))
        return JsonResponse({'success': True, 'waste_types': w_types, 'departments': depts})
    except Exception as e: return JsonResponse({'success': False, 'error': str(e)}, status=500)

# 其餘預留
def db_department_index(request): return render(request, 'management/db-department.html', {'departments': Department.objects.all(), 'waste_types': WasteType.objects.all()})
def visualize_index(request): return render(request, 'management/visualize.html')
def visualize_department_index(request): return render(request, 'management/vis-department.html')
def qrcode_print_view(request): return render(request, 'management/qrcode_print.html', {'departments': Department.objects.all(), 'waste_types': WasteType.objects.all()})
def api_visualize_transport_data(request): return JsonResponse({'success': True})
def get_data(request): return JsonResponse({'success': True})
def save_data(request): return JsonResponse({'success': True})
def delete_data(request): return JsonResponse({'success': True})
def batch_import(request): return JsonResponse({'success': True})
def get_month_status(request): return JsonResponse({'success': True})
def get_department_data(request): return JsonResponse({'success': True})
def save_department_data(request): return JsonResponse({'success': True})
def api_save_location(request): return JsonResponse({'success': True})
def api_save_agency(request): return JsonResponse({'success': True})