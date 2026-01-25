from django.shortcuts import render
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from datetime import datetime, timedelta
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
import random
import json

# =========================================================
# 🟢 模擬資料產生器 (保留您的字典結構)
# =========================================================

# 下拉選單資料
dept_names = ['病理檢驗部', '急診室', '放射科', '住院部', '行政中心']
loc_names = ['B1 汙物室', '一樓大廳', '二樓護理站', '實驗室', '戶外暫存區']
user_names = ['王小明', '李大華', '張阿姨', 'Admin']
agency_names = ['大安環保公司', '綠色清運科技', '永續處理中心']

departments_list = [{'id': i, 'name': n} for i, n in enumerate(dept_names)]
locations_list = [{'id': i, 'name': n} for i, n in enumerate(loc_names)]
weighers_list = [{'id': i, 'name': n} for i, n in enumerate(user_names)]
process_agencies = [{'id': i, 'name': n} for i, n in enumerate(agency_names)]
clear_agencies = [{'id': i, 'name': n} for i, n in enumerate(agency_names)]

# 主資料 (全域變數，模擬資料庫)
all_records = []

def generate_data():
    if all_records: return
    random.seed(42)
    for i in range(100):
        hours_ago = random.randint(1, 1000) # 拉長時間範圍，確保有過期資料
        create_time = datetime.now() - timedelta(hours=hours_ago)
        
        # 這裡只產生基礎屬性，is_expired 交給 View 動態算
        dept_id = random.randint(0, len(dept_names)-1)
        loc_id = random.randint(0, len(loc_names)-1)
        user_id = random.randint(0, len(user_names)-1)
        is_transported = random.choice([True, False])

        fake_record = {
            'id': i + 1,
            'create_time': create_time,
            'weight': round(random.uniform(0.5, 25.0), 2),
            'is_transported': is_transported,
            # 'is_expired': 這裡不寫死，由 View 計算
            'department': {'name': dept_names[dept_id], 'id': dept_id},
            'location':   {'name': loc_names[loc_id],   'id': loc_id},
            'creator':    {'name': user_names[user_id], 'id': user_id},
            'updater':    {'name': '系統管理員'} if is_transported else {'name': None},
            'update_time': datetime.now() if is_transported else None,
        }
        all_records.append(fake_record)

generate_data() # 啟動時執行

# =========================================================
# 🟢 結算頁面 View
# =========================================================
@login_required
def settlement_view(request):
    
    # 1. 接收篩選參數
    f_start_date = request.GET.get('start_date', '')
    f_end_date = request.GET.get('end_date', '')
    f_location = request.GET.get('location', '')
    f_dept = request.GET.get('dept', '')
    f_weigher = request.GET.get('weigher', '')
    sort_by = request.GET.get('sort_by', 'newest')
    
    # 2. 執行篩選
    filtered_records = []
    for r in all_records:
        match = True
        if f_start_date:
            try:
                sd = datetime.strptime(f_start_date, '%Y-%m-%d')
                if r['create_time'] < sd: match = False
            except ValueError: pass
        if f_end_date:
            try:
                ed = datetime.strptime(f_end_date, '%Y-%m-%d') + timedelta(days=1)
                if r['create_time'] >= ed: match = False
            except ValueError: pass
        
        # ID 比對 (轉成字串比較保險)
        if f_location and str(r['location']['id']) != str(f_location): match = False
        if f_dept and str(r['department']['id']) != str(f_dept): match = False
        if f_weigher and str(r['creator']['id']) != str(f_weigher): match = False

        if match:
            filtered_records.append(r)

    # 3. 執行排序
    if sort_by == 'newest':
        filtered_records.sort(key=lambda x: x['create_time'], reverse=True)
    elif sort_by == 'oldest':
        filtered_records.sort(key=lambda x: x['create_time'], reverse=False)
    elif sort_by == 'weight_desc':
        filtered_records.sort(key=lambda x: x['weight'], reverse=True)
    elif sort_by == 'weight_asc':
        filtered_records.sort(key=lambda x: x['weight'], reverse=False)

    # 4. 分頁處理
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
        page_obj = paginator.page(1)

    # =========================================================
    # 🟢 5. 關鍵修改：直接在程式裡判斷過期 (支援字典寫法)
    # =========================================================
    now = datetime.now()
    expiry_days = 30 # 設定 30 天過期

    for record in page_obj:
        # 使用 ['key'] 存取字典，這就是之前報錯的原因修正
        expiration_date = record['create_time'] + timedelta(days=expiry_days)
        is_expired = now > expiration_date
        
        # 將計算結果寫回字典
        record['is_expired'] = is_expired
        # 更新刪除權限 (未過期 且 未載運 才能刪除)
        record['can_delete'] = (not is_expired) and (not record['is_transported'])

    # 6. 回傳 Context
    context = {
        'page_obj': page_obj,
        'current_page_size': page_size,
        'start_date': f_start_date,
        'end_date': f_end_date,
        'selected_location': f_location,
        'selected_dept': f_dept,
        'selected_weigher': f_weigher,
        'current_sort': sort_by,
        'departments': departments_list,
        'locations': locations_list,
        'weighers': weighers_list,
        'process_agencies': process_agencies,
        'clear_agencies': clear_agencies,
    }

    # 路徑：dashboard_extension/settlement_fragment.html
    return render(request, 'dashboard_extension/settlement_fragment.html', context)

# =========================================================
# API: 刪除功能 (配合前端)
# =========================================================
@require_POST
@login_required
def delete_records_api(request):
    try:
        data = json.loads(request.body)
        record_ids = list(map(str, data.get('ids', [])))
        
        global all_records
        before_len = len(all_records)
        # 刪除 ID 在列表中的資料
        all_records = [r for r in all_records if str(r['id']) not in record_ids]
        
        return JsonResponse({'status': 'success', 'deleted_count': before_len - len(all_records)})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

# 佔位用，避免 urls 報錯
@login_required
def mobile_input_view(request):
    return render(request, 'dashboard_extension/mobile_input.html', {'locations': locations_list})

@require_POST
def record_waste_api(request):
    return JsonResponse({'status': 'ok'})