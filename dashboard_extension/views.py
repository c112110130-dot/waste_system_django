from django.shortcuts import render
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from datetime import datetime, timedelta
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
import random
import json

# =========================================================
# 🟢 1. 模擬資料產生器
# =========================================================

dept_names = ['病理檢驗部', '急診室', '放射科', '住院部', '行政中心']
loc_names = ['B1 汙物室', '一樓大廳', '二樓護理站', '實驗室', '戶外暫存區']
user_names = ['王小明', '李大華', '張阿姨', 'Admin']
agency_names = ['大安環保公司', '綠色清運科技', '永續處理中心']

# 轉換成前端需要的格式
departments_list = [{'id': i, 'name': n} for i, n in enumerate(dept_names)]
locations_list = [{'id': i, 'name': n} for i, n in enumerate(loc_names)]
weighers_list = [{'id': i, 'name': n} for i, n in enumerate(user_names)]
process_agencies = [{'id': i, 'name': n} for i, n in enumerate(agency_names)]
clear_agencies = [{'id': i, 'name': n} for i, n in enumerate(agency_names)]

all_records = []

def generate_data():
    """產生假資料 (只執行一次)"""
    # 強制清空舊資料，避免格式衝突
    global all_records
    all_records = [] 
    
    random.seed(42)
    
    for i in range(100):
        # 1. 隨機產生時間
        hours_ago = random.randint(1, 240) 
        create_time = datetime.now() - timedelta(hours=hours_ago)
        
        # 2. 這裡只為了產生假資料的合理性，不儲存判斷結果
        # (例如：很久以前的資料，通常已經載運了)
        temp_is_expired = (datetime.now() - create_time).days > 3
        if temp_is_expired:
            is_transported = random.choices([True, False], weights=[0.9, 0.1])[0]
        else:
            is_transported = random.choice([True, False])

        # 3. 隨機分配 ID
        dept_id = random.randint(0, len(dept_names)-1)
        loc_id = random.randint(0, len(loc_names)-1)
        user_id = random.randint(0, len(user_names)-1)

        # 4. 建立單筆資料字典 (注意：不存 is_expired 和 can_delete)
        fake_record = {
            'id': i + 1,
            'create_time': create_time,
            'weight': round(random.uniform(0.5, 25.0), 2),
            'is_transported': is_transported,
            'department': {'name': dept_names[dept_id], 'id': dept_id},
            'location':   {'name': loc_names[loc_id],   'id': loc_id},
            'creator':    {'name': user_names[user_id], 'id': user_id},
            'updater':    {'name': '系統管理員'} if is_transported else {'name': None},
            'update_time': datetime.now() if is_transported else None,
        }
        all_records.append(fake_record)

# 啟動時產生資料
generate_data()


# =========================================================
# 🟢 2. 結算頁面 View (動態計算核心)
# =========================================================
@login_required
def settlement_view(request):
    
    # 重新產生資料以防萬一 (開發階段用)
    if not all_records: generate_data()

    # STEP 3: 接收篩選參數
    f_start_date = request.GET.get('start_date', '')
    f_end_date = request.GET.get('end_date', '')
    f_location = request.GET.get('location', '')
    f_dept = request.GET.get('dept', '')
    f_weigher = request.GET.get('weigher', '')
    sort_by = request.GET.get('sort_by', 'newest')

    # STEP 4: 執行篩選
    filtered_records = []
    
    for r in all_records:
        match = True
        
        # 防呆：確保 r 是字典
        if not isinstance(r, dict): continue

        # 1. 日期區間篩選
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

        # 2. 定點/部門/人員篩選
        if f_location and str(r['location']['id']) != str(f_location): match = False
        if f_dept and str(r['department']['id']) != str(f_dept): match = False
        if f_weigher and str(r['creator']['id']) != str(f_weigher): match = False

        if match:
            filtered_records.append(r)

    # STEP 5: 執行排序
    if sort_by == 'newest':
        filtered_records.sort(key=lambda x: x['create_time'], reverse=True)
    elif sort_by == 'oldest':
        filtered_records.sort(key=lambda x: x['create_time'], reverse=False)
    elif sort_by == 'weight_desc':
        filtered_records.sort(key=lambda x: x['weight'], reverse=True)
    elif sort_by == 'weight_asc':
        filtered_records.sort(key=lambda x: x['weight'], reverse=False)

    # STEP 6: 分頁處理
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
    # 🟢 STEP 6.5: 動態計算區 (Dynamic Calculation)
    # =========================================================
    now = datetime.now()
    
    for record in page_obj:
        # 1. 算出是否過期 (超過 3 天)
        # 注意：這裡使用字典 key 存取
        delta = now - record['create_time']
        is_expired = delta.days > 3
        
        # 2. 寫入暫存屬性
        record['is_expired'] = is_expired
        
        # 3. 算出是否可刪除 (新要求：用算的)
        # 邏輯：只有「未過期」且「未載運」的才能刪除
        record['can_delete'] = (not is_expired) and (not record['is_transported'])


    # STEP 7: 打包 Context
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
    
    return render(request, 'dashboard_extension/settlement_fragment.html', context)


# =========================================================
# 3. 刪除 API
# =========================================================
@require_POST
@login_required
def delete_records_api(request):
    try:
        data = json.loads(request.body)
        record_ids = list(map(str, data.get('ids', [])))
        
        global all_records
        before_len = len(all_records)
        all_records = [r for r in all_records if str(r['id']) not in record_ids]
        
        return JsonResponse({'status': 'success', 'deleted_count': before_len - len(all_records)})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)


# =========================================================
# 4. 手機端佔位符
# =========================================================
@login_required
def mobile_input_view(request):
    return render(request, 'dashboard_extension/mobile_input.html', {'locations': []})

@require_POST
def record_waste_api(request):
    return JsonResponse({'status': 'ok'})