from django.shortcuts import render,redirect
from django.contrib import messages
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from datetime import datetime, timedelta
from django.utils import timezone
from django.http import JsonResponse
from django.views.decorators.http import require_POST,require_GET
from django.contrib.auth.decorators import login_required
import json
from django.db.models import Sum, Count, Q
from Main.models import UserProfile

from WasteManagement.models import WasteRecord_New,  LocationPoint, Department, clearAgency, processAgency, TransportRecord,WasteType



transport_batches = TransportRecord.objects.filter().order_by('-settle_time')

@require_POST
@login_required
def delete_records(request):
    try:
        # 從 POST 資料中取得 IDs
        ids_str = request.POST.get('ids', '')
        if ids_str:
            id_list = ids_str.split(',')
            # 執行資料庫刪除
            WasteRecord_New.objects.filter(id__in=id_list).delete()
            return JsonResponse({'status': 'success'})
        return JsonResponse({'status': 'error', 'message': 'No IDs provided'}, status=400)
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)


@require_POST
@login_required
def settlement_process(request):
    print("=== 1. 進入 settlement_process ===") 
    ids_str = request.POST.get('selected_ids')
    process_agency_id = request.POST.get('process_agency')
    clear_agency_id = request.POST.get('clear_agency')
    print(f"=== 2. 接收到的資料: IDs={ids_str}, Process={process_agency_id}, Clear={clear_agency_id} ===")
    if ids_str and process_agency_id and clear_agency_id:
        try:
            print("=== 3. 準備建立 TransportRecord ===")
            new_transport = TransportRecord.objects.create(
                settler_id=request.user.id,
                process_agency_id=process_agency_id,
                clear_agency_id=clear_agency_id,  
            )
            print(f"=== 4. TransportRecord 建立成功 ID: {new_transport.id} ===")
            id_list = ids_str.split(',')
            
            updated_count = WasteRecord_New.objects.filter(id__in=id_list).update(
                is_transported=True,
                transportrecord=new_transport
            )
            print("=== 5. WasteRecord 更新成功 ===")
            messages.success(request, f'成功結算 {updated_count} 筆資料，並建立清運單 #{new_transport.id}！')

        except Exception as e:
            messages.error(request, f'結算失敗：{str(e)}')
    else:
        
        messages.error(request, '資料不完整，請選擇機構並確認有勾選資料。')
        
    return redirect('dashboard:settlement_page') 


@login_required
def settlement_view(request):
    departments_list = Department.objects.all()
    locations_list = LocationPoint.objects.all()
    weighers_list = UserProfile.objects.all()
    process_agencies = processAgency.objects.all()
    clear_agencies = clearAgency.objects.all()
    Waste_types = WasteType.objects.all()
    all_records =  WasteRecord_New.objects.filter().order_by('-create_time')
    f_start_date = request.GET.get('start_date', '')
    f_end_date = request.GET.get('end_date', '')
    f_location = request.GET.get('location', '')
    f_dept = request.GET.get('dept', '')
    f_weigher = request.GET.get('weigher', '')
    f_waste_type = request.GET.get('waste_type', '')
    sort_by = request.GET.get('sort_by', 'newest') # 預設排序：最新

    filtered_records =  []
    
    for r in all_records:
        match = True
        
        # 1. 日期區間篩選
        if f_start_date:
            try:
                naive_sd = datetime.strptime(f_start_date, '%Y-%m-%d')
                sd = timezone.make_aware(naive_sd)
                if r.create_time < sd: match = False
            except ValueError: pass
        if f_end_date:
            try:
                # 結束日期包含當天，所以加一天變成當日 23:59:59 的概念
                naive_ed = datetime.strptime(f_end_date, '%Y-%m-%d') + timedelta(days=1)
                ed = timezone.make_aware(naive_ed)
                if r.create_time >= ed: match = False
            except ValueError: pass

        # 2. 定點/部門/人員篩選 (比對 ID)
        if f_location and str(r.location_id) != str(f_location): match = False
        if f_dept and str(r.department_id) != str(f_dept): match = False
        if f_weigher and str(r.creator_id) != str(f_weigher): match = False
        if f_waste_type and str(r.waste_type_id) != str(f_waste_type): match = False

        if match:
            filtered_records.append(r)

    if sort_by == 'newest':
        # 預設使用當前時間防止 key error (若資料庫欄位名不同請修改)
        filtered_records.sort(key=lambda x: getattr(x, 'create_time', datetime.now()), reverse=True)
    elif sort_by == 'oldest':
        filtered_records.sort(key=lambda x: getattr(x, 'create_time', datetime.now()), reverse=False)
    elif sort_by == 'weight_desc':
        filtered_records.sort(key=lambda x: getattr(x, 'weight', 0), reverse=True)
    elif sort_by == 'weight_asc':
        filtered_records.sort(key=lambda x: getattr(x, 'weight', 0), reverse=False)

    page_size_param = request.GET.get('page_size', '10')
    try:
        page_size = int(page_size_param)
    except ValueError:
        page_size = 10

    paginator = Paginator(filtered_records, page_size)
    page_number = request.GET.get('page', 1)

    try:
        page_obj = paginator.page(page_number)
    except (PageNotAnInteger, EmptyPage):
        # 若頁數錯誤，預設回傳第一頁
        page_obj = paginator.page(1)

    context = {
        'page_obj': page_obj,
        'current_page_size': page_size,
        
        'start_date': f_start_date,
        'end_date': f_end_date,
        'selected_location': f_location,
        'selected_dept': f_dept,
        'selected_weigher': f_weigher,
        'selected_waste_type': f_waste_type,
        'current_sort': sort_by,

        'departments': departments_list,
        'locations': locations_list,
        'weighers': weighers_list,
        'waste_types': Waste_types,
        'process_agencies': process_agencies,
        'clear_agencies': clear_agencies,
    }

    return render(request, 'dashboard_extension/settlement_fragment.html', context)


@login_required
def transportation_view(request):
    
    f_start_date = request.GET.get('start_date', '')
    f_end_date = request.GET.get('end_date', '')
    f_agency = request.GET.get('agency', '') 
    sort_by = request.GET.get('sort_by', 'newest')
    
    try: 
        page_size = int(request.GET.get('page_size', '10'))
    except ValueError: 
        page_size = 10

    batches = TransportRecord.objects.select_related(
        'clear_agency', 'process_agency', 'settler'
    ).annotate(
        db_total_weight=Sum('wasterecord_new__weight'),  
        db_item_count=Count('wasterecord_new')
    ).prefetch_related('wasterecord_new_set')
    
    if f_start_date:
        try:
            start_dt = timezone.make_aware(datetime.strptime(f_start_date, '%Y-%m-%d'))
            batches = batches.filter(settle_time__gte=start_dt)
        except ValueError: pass
        
    if f_end_date:
        try:
            end_dt = timezone.make_aware(datetime.strptime(f_end_date, '%Y-%m-%d') + timedelta(days=1))
            batches = batches.filter(settle_time__lt=end_dt)
        except ValueError: pass
    agency_id = None
    if f_agency:
        try:
            agency_type, agency_id = f_agency.split('_')
            f_agency = agency_type
            agency_id = int(agency_id)
            if agency_type == 'clear':
                batches = batches.filter(clear_agency_id=agency_id)
                
            elif agency_type == 'process':
                batches = batches.filter(process_agency_id=agency_id)
        except ValueError:
            pass

    weight_data = batches.aggregate(weight_sum=Sum('db_total_weight'))
    raw_weight = weight_data['weight_sum'] or 0
    total_weight_sum = round(raw_weight, 2)
    if sort_by == 'newest':
        batches = batches.order_by('-settle_time')
    elif sort_by == 'oldest':
        batches = batches.order_by('settle_time')
    elif sort_by == 'weight_desc':
        batches = batches.order_by('-db_total_weight')
    elif sort_by == 'weight_asc':
        batches = batches.order_by('db_total_weight')
    else:
        batches = batches.order_by('-settle_time')

    paginator = Paginator(batches, page_size) 
    page_obj = paginator.get_page(request.GET.get('page', 1))

    # 8. 準備下拉選單資料
    try:
        process_agencies = processAgency.objects.filter()
        clear_agencies = clearAgency.objects.filter()
    except:
        process_agencies = []
        clear_agencies = []

    context = {
        'agency_ids': agency_id,
        'page_obj': page_obj, 
        'start_date': f_start_date, 
        'end_date': f_end_date,
        'selected_agency': f_agency, 
        'current_page_size': page_size,
        'current_sort': sort_by,
        'total_weight_sum': round(total_weight_sum, 2),
        'clear_agencies': clear_agencies,
        'process_agencies': process_agencies,
    }
    
    return render(request, 'dashboard_extension/transportation.html', context)

@login_required
def mobile_station_view(request):
    locations_list = list(LocationPoint.objects.values('id', 'name'))
    context = {
        # 這裡傳 list 給模板
        'locations': locations_list,
    }
    return render(request, 'dashboard_extension/mobile/station.html', context)

@require_POST
@login_required
def delete_records_api(request):
    try:
        # 1. 解析前端傳來的 JSON 資料
        # 因為前端 fetch header 是 'application/json'，資料不在 POST 裡，而在 body 裡
        data = json.loads(request.body)
        ids = data.get('ids', [])

        if ids:
            # 2. 找出要刪除的清運單
            batches_to_delete = TransportRecord.objects.filter(id__in=ids)
            
            # === 🔥 關鍵邏輯：釋放廢棄物紀錄 (Safe Delete) ===
            # 在刪除單據前，先把裡面的廢棄物紀錄狀態還原
            # 這樣它們就會回到「未結算列表」，而不會憑空消失
            # 注意：這裡的 filter 條件是 transportRecord__in (反向關聯查找)
            WasteRecord_New.objects.filter(transportrecord__in=batches_to_delete).update(
                is_transported=False,  # 標記為未運送
                transportrecord=None   # 解除關聯 (變回 NULL)
            )

            # 3. 安全之後，才執行刪除清運單
            deleted_count, _ = batches_to_delete.delete()
            
            return JsonResponse({'status': 'success', 'deleted': deleted_count})
        else:
            return JsonResponse({'status': 'error', 'message': '未提供 ID'}, status=400)

    except Exception as e:
        print(f"API 刪除錯誤: {str(e)}")  # 建議印出來方便除錯
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
    except Exception as e:
        print(f"刪除失敗: {e}")
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

@require_POST
@login_required
def delete_batches_api(request):
    try:
        # 1. 解析前端傳來的 JSON 資料
        # 因為前端 fetch header 是 'application/json'，資料不在 POST 裡，而在 body 裡
        data = json.loads(request.body)
        ids = data.get('ids', [])

        if ids:
            # 2. 找出要刪除的清運單
            batches_to_delete = TransportRecord.objects.filter(id__in=ids)
            
            # === 🔥 關鍵邏輯：釋放廢棄物紀錄 (Safe Delete) ===
            # 在刪除單據前，先把裡面的廢棄物紀錄狀態還原
            # 這樣它們就會回到「未結算列表」，而不會憑空消失
            # 注意：這裡的 filter 條件是 transportRecord__in (反向關聯查找)
            WasteRecord_New.objects.filter(transportrecord__in=batches_to_delete).update(
                is_transported=False,  # 標記為未運送
                transportrecord=None   # 解除關聯 (變回 NULL)
            )

            # 3. 安全之後，才執行刪除清運單
            deleted_count, _ = batches_to_delete.delete()
            
            return JsonResponse({'status': 'success', 'deleted': deleted_count})
        else:
            return JsonResponse({'status': 'error', 'message': '未提供 ID'}, status=400)

    except Exception as e:
        print(f"API 刪除錯誤: {str(e)}")  # 建議印出來方便除錯
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
    except Exception as e:
        print(f"刪除失敗: {e}")
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)


@require_POST
@login_required
def record_waste_api(request):
    try:
        # 解析 JSON 資料
        data = json.loads(request.body)
        dept = data.get('dept')
        waste_type = data.get('waste_type')
        loc_id = data.get('location_id')
        weight = data.get('weight')

        if not loc_id or not weight or not dept or not waste_type:
            return JsonResponse({'status': 'error', 'message': '資料不完整'})

        # 寫入資料庫邏輯
        loc_id = LocationPoint.objects.get(id=loc_id)
        dept_id = Department.objects.get(name=dept)
        waste_type = WasteType.objects.get(name=waste_type)
        WasteRecord_New.objects.create(
            location=loc_id,
            department=dept_id,
            weight=weight,
            waste_type=waste_type,
            creator=request.user,
            updater=request.user
        )
        
        return JsonResponse({'status': 'success'})

    except LocationPoint.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': '地點不存在'})
    except Department.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': '部門不存在'})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)})
    
@require_GET
@login_required
def locations_api(request):
    locations_list = LocationPoint.objects.all()
    try:
        return JsonResponse({'locations': locations_list})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

    
@login_required
def location_management_view(request):
    locations_list = LocationPoint.objects.all()
    clear_agencies = clearAgency.objects.all()
    process_agencies = processAgency.objects.all()
    context = {
        'locations': locations_list,
        'clear_agencies': clear_agencies,
        'process_agencies': process_agencies,
    }
    return render(request, 'dashboard_extension/location_management.html', context)


# =========================================================
# 6-1. API：儲存/編輯/新增 定點
# =========================================================
@require_POST
@login_required
def api_save_location(request):
    locations_list = LocationPoint.objects.all()
    try:
        data = json.loads(request.body)
        loc_id = data.get('id')
        name = data.get('name', '').strip()
        code = data.get('code', '').strip() 
            
        if not name: return JsonResponse({'success': False, 'error': '定點名稱不能為空'})
        if not code: return JsonResponse({'success': False, 'error': '定點代碼不能為空'})

        if loc_id and loc_id != 'new':
            # 編輯現有資料
            for loc in locations_list:
                if str(loc.id) == str(loc_id):
                    loc.name = name
                    loc.code = code
                    loc.save()
                    break
        else:
            # 新增資料
            LocationPoint.objects.create(name=name, code=code)      
        return JsonResponse({'success': True, 'message': '定點儲存成功'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

# =========================================================
# 6-2. API：刪除 定點
# =========================================================
@require_POST
@login_required
def api_delete_location(request):
    try:
        data = json.loads(request.body)
        ids_to_delete = data.get('ids', [])
        
        # 刪除所有被選中的 LocationPoint 物件
        LocationPoint.objects.filter(id__in=[int(i) for i in ids_to_delete]).delete()
        
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

# =========================================================
# 6-3. API：儲存/編輯/新增 機構
# =========================================================
@require_POST
@login_required
def api_save_agency(request):
    try:
        data = json.loads(request.body)
        raw_id = data.get('id') 
        name = data.get('name', '').strip()
        code = data.get('code', '').strip()
        new_type = data.get('type', '')
        
        if not name: return JsonResponse({'success': False, 'error': '機構名稱不能為空'})
        if not code: return JsonResponse({'success': False, 'error': '機構代碼不能為空'})
            
        if raw_id and raw_id != 'new':
            old_type, actual_id = raw_id.split('_')[0], raw_id.split('_')[1]
            if old_type == 'clear':
                if new_type == 'process':
                    # 從 clear 變 process
                    clearAgency.objects.filter(id=actual_id).delete()
                    processAgency.objects.create(name=name, code=code)
                elif new_type == 'clear':
                    clearAgency.objects.filter(id=actual_id).update(name=name, code=code)
            else:
                if new_type == 'clear':
                    # 從 process 變 clear
                    processAgency.objects.filter(id=actual_id).delete()
                    clearAgency.objects.create(name=name, code=code)
                elif new_type == 'process':
                    processAgency.objects.filter(id=actual_id).update(name=name, code=code)
        else:
            # 新增資料
            if new_type == 'clear':
                clearAgency.objects.create(name=name, code=code)
            else:
                processAgency.objects.create(name=name, code=code)

        return JsonResponse({'success': True, 'message': '機構儲存成功'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

# =========================================================
# 6-4. API：刪除 機構
# =========================================================
@require_POST
@login_required
def api_delete_agency(request):
    try:
        data = json.loads(request.body)
        raw_ids = data.get('ids', []) # ex: ['clear_1', 'process_2']
        
        # 解析出要刪除的清理機構 ID 和 處理機構 ID
        clear_ids = [i.split('_')[1] for i in raw_ids if i.startswith('clear_')]
        process_ids = [i.split('_')[1] for i in raw_ids if i.startswith('process_')]
        
        # 刪除清理機構和處理機構
        clearAgency.objects.filter(id__in=clear_ids).delete()
        processAgency.objects.filter(id__in=process_ids).delete()
        
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})     

    # =========================================================
# 7. QR Code 列印頁面
# =========================================================
# @login_required
def qrcode_print_view(request):
    departments_list = Department.objects.all()
    waste_types_list = WasteType.objects.all()
    if request.user.is_authenticated:
        # 🟢 順序對調：先抓 first_name (在中文通常被當作姓氏) 再抓 last_name (名字)
        full_name = f"{request.user.first_name}{request.user.last_name}".strip()
        current_user = full_name if full_name else request.user.username
    else:
        current_user = '測試人員'
        
    context = {
        'departments': departments_list,
        'waste_types': waste_types_list,
        'current_user': current_user
    }
    return render(request, 'dashboard_extension/qrcode_print.html', context)