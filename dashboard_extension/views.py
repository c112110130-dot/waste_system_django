from urllib import request
from django.shortcuts import render,redirect
from django.contrib import messages
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from datetime import datetime, timedelta
from django.utils import timezone
from django.http import JsonResponse
from django.views.decorators.http import require_POST

import random

from Main.models import UserProfile



# TODO: 給負責資料庫的組員
# 請在此引入您的 Models，例如：
from .models import WasteRecord, Department, LocationPoint, clearAgency, processAgency, TransportRecord

@require_POST
def delete_records(request):
    try:
        # 從 POST 資料中取得 IDs
        ids_str = request.POST.get('ids', '')
        if ids_str:
            id_list = ids_str.split(',')
            # 執行資料庫刪除
            WasteRecord.objects.filter(id__in=id_list).delete()
            return JsonResponse({'status': 'success'})
        return JsonResponse({'status': 'error', 'message': 'No IDs provided'}, status=400)
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)


@require_POST
def settlement_process(request):
    # 1. 取得表單資料
    print("=== 1. 進入 settlement_process ===") # 確認有沒有進來
    ids_str = request.POST.get('selected_ids')
    process_agency_id = request.POST.get('process_agency')
    clear_agency_id = request.POST.get('clear_agency')
    print(f"=== 2. 接收到的資料: IDs={ids_str}, Process={process_agency_id}, Clear={clear_agency_id} ===")
    if ids_str and process_agency_id and clear_agency_id:
        try:
            print("=== 3. 準備建立 TransportRecord ===")
            # 2. 先建立一筆新的「清運紀錄 (TransportRecord)」
            # 假設你的 TransportRecord 模型有這些欄位，請根據實際情況調整
            new_transport = TransportRecord.objects.create(
                settlement_staff_id=request.user.id,
                processAgency_id=process_agency_id,
                clearAgency_id=clear_agency_id,  
            )
            print(f"=== 4. TransportRecord 建立成功 ID: {new_transport.id} ===")
            # 3. 處理廢棄物紀錄
            id_list = ids_str.split(',')
            
            # 執行批量更新：
            # (A) 設為已運送 (is_transported=True)
            # (B) 關聯到剛剛建立的清運單 (TransportRecord=new_transport)
            updated_count = WasteRecord.objects.filter(id__in=id_list).update(
                can_delete=False,
                is_transported=True,
                TransportRecord=new_transport
            )
            print("=== 5. WasteRecord 更新成功 ===")
            messages.success(request, f'成功結算 {updated_count} 筆資料，並建立清運單 #{new_transport.id}！')

        except Exception as e:
            messages.error(request, f'結算失敗：{str(e)}')
    else:
        
        messages.error(request, '資料不完整，請選擇機構並確認有勾選資料。')
        
    return redirect('dashboard:settlement_page') 

def settlement_view(request):
    """
    結算資料顯示頁面
    目前狀態：預設無資料 (Empty State)，等待串接資料庫。
    備註：下方保留了完整的假資料產生邏輯，若需測試 UI 可將註解打開。
    """
    
    # =========================================================
    # 🟢 STEP 1: 下拉選單資料來源 (目前預設為空，請改接資料庫)
    # =========================================================

    departments_list = Department.objects.all()
    locations_list = LocationPoint.objects.all()
    weighers_list = UserProfile.objects.all()
    process_agencies = processAgency.objects.all()
    clear_agencies = clearAgency.objects.all()
    # =========================================================
    # 🟡 備份：下拉選單假資料 (測試用，已註解)
    # 若要測試 UI，請解除以下區塊的註解
    # =========================================================
    """
    # 定義選項名稱
    dept_names = ['病理檢驗部', '急診室', '放射科', '住院部', '行政中心']
    loc_names = ['B1 汙物室', '一樓大廳', '二樓護理站', '實驗室', '戶外暫存區']
    user_names = ['王小明', '李大華', '張阿姨', 'Admin']
    agency_names = ['大安環保公司', '綠色清運科技', '永續處理中心']

    # 轉換成前端需要的格式 [{'id': 0, 'name': '...'}, ...]
    departments_list = [{'id': i, 'name': n} for i, n in enumerate(dept_names)]
    locations_list = [{'id': i, 'name': n} for i, n in enumerate(loc_names)]
    weighers_list = [{'id': i, 'name': n} for i, n in enumerate(user_names)]
    process_agencies = [{'id': i, 'name': n} for i, n in enumerate(agency_names)]
    clear_agencies = [{'id': i, 'name': n} for i, n in enumerate(agency_names)]
    """
    # =========================================================


    # =========================================================
    # 🟢 STEP 2: 主資料來源 (目前預設為空，請改接資料庫)
    # =========================================================
    
    # 這裡是用來放最終要顯示的資料列表
    all_records =  WasteRecord.objects.all().order_by('-create_time')

    # TODO: 組員請在這裡接上資料庫
    # 範例寫法：
    # all_records = WasteRecord.objects.all().order_by('-create_time')
    # 若使用 ORM，下方的篩選邏輯建議改寫為 .filter() 以提升效能


    # =========================================================
    # 🟡 備份：主資料假資料產生器 (測試用，已註解)
    # 若要測試 UI，請解除以下區塊的註解
    # =========================================================
    
    random.seed(42) # 固定種子，讓每次重新整理資料不會變
    
    # 必須重新定義一次名稱陣列，避免上方區塊沒打開時報錯
    _dept_names = ['病理檢驗部', '急診室', '放射科', '住院部', '行政中心']
    _loc_names = ['B1 汙物室', '一樓大廳', '二樓護理站', '實驗室', '戶外暫存區']
    _user_names = ['王小明', '李大華', '張阿姨', 'Admin']

    for i in range(100):
        # 1. 隨機產生時間 (過去 10 天內)
        hours_ago = random.randint(1, 240) 
        create_time = datetime.now() - timedelta(hours=hours_ago)
        
        # 2. 判斷是否過期 (超過 3 天算過期)
        is_expired = (datetime.now() - create_time).days > 3
        
        # 3. 隨機決定是否已載運
        # 如果過期了，有較高機率是已經載運走的 (權重調整)
        if is_expired:
            is_transported = random.choices([True, False], weights=[0.9, 0.1])[0]
        else:
            is_transported = random.choice([True, False])

        # 4. 判斷是否可刪除 (只有「未過期」且「未載運」的才能刪除)
        can_delete = (not is_expired) and (not is_transported)
        
        # 5. 隨機分配 ID (對應下拉選單)
        dept_id = random.randint(0, len(_dept_names)-1)
        loc_id = random.randint(0, len(_loc_names)-1)
        user_id = random.randint(0, len(_user_names)-1)

        # 6. 建立單筆資料字典
        """
        fake_record = {
            'id': i + 1,
            'create_time': create_time,
            'weight': round(random.uniform(0.5, 25.0), 2), # 隨機重量 0.5 ~ 25.0 kg
            'is_transported': is_transported,
            'can_delete': can_delete, 
            'is_expired': is_expired,
            'department': {'name': _dept_names[dept_id], 'id': dept_id},
            'location':   {'name': _loc_names[loc_id],   'id': loc_id},
            'creator':    {'name': _user_names[user_id], 'id': user_id},
            'updater':    {'name': '系統管理員'} if is_transported else {'name': None},
            'update_time': datetime.now() if is_transported else None,
        }
        
        all_records.append(fake_record)
        """
    # =========================================================


    # =========================================================
    # 🟢 STEP 3: 接收篩選參數
    # =========================================================
    f_start_date = request.GET.get('start_date', '')
    f_end_date = request.GET.get('end_date', '')
    f_location = request.GET.get('location', '')
    f_dept = request.GET.get('dept', '')
    f_weigher = request.GET.get('weigher', '')
    sort_by = request.GET.get('sort_by', 'newest') # 預設排序：最新


    # =========================================================
    # 🟢 STEP 4: 執行篩選 (Python List Filter)
    # 注意：若改接資料庫，建議將此段改為 Django ORM 的 .filter()
    # =========================================================
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

        if match:
            filtered_records.append(r)


    # =========================================================
    # 🟢 STEP 5: 執行排序
    # =========================================================
    if sort_by == 'newest':
        # 預設使用當前時間防止 key error (若資料庫欄位名不同請修改)
        filtered_records.sort(key=lambda x: getattr(x, 'create_time', datetime.now()), reverse=True)
    elif sort_by == 'oldest':
        filtered_records.sort(key=lambda x: getattr(x, 'create_time', datetime.now()), reverse=False)
    elif sort_by == 'weight_desc':
        filtered_records.sort(key=lambda x: getattr(x, 'weight', 0), reverse=True)
    elif sort_by == 'weight_asc':
        filtered_records.sort(key=lambda x: getattr(x, 'weight', 0), reverse=False)

    # =========================================================
    # 🟢 STEP 6: 分頁處理 (Pagination)
    # =========================================================
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


    # =========================================================
    # 🟢 STEP 7: 打包 Context 回傳給 Template
    # =========================================================
    context = {
        'page_obj': page_obj,
        'current_page_size': page_size,
        
        # 回傳篩選狀態 (讓前端記住使用者的選擇)
        'start_date': f_start_date,
        'end_date': f_end_date,
        'selected_location': f_location,
        'selected_dept': f_dept,
        'selected_weigher': f_weigher,
        'current_sort': sort_by,

        # 下拉選單資料 (目前為空，或為假資料)
        'departments': departments_list,
        'locations': locations_list,
        'weighers': weighers_list,
        'process_agencies': process_agencies,
        'clear_agencies': clear_agencies,
    }

    return render(request, 'dashboard_extension/settlement_fragment.html', context)