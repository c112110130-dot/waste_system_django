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

departments_list = [{'id': i, 'name': n} for i, n in enumerate(dept_names)]
locations_list = [{'id': i, 'name': n} for i, n in enumerate(loc_names)]
weighers_list = [{'id': i, 'name': n} for i, n in enumerate(user_names)]
process_agencies = [{'id': i, 'name': n} for i, n in enumerate(agency_names)]
clear_agencies = [{'id': i, 'name': n} for i, n in enumerate(agency_names)]

all_records = []

def generate_data():
    global all_records
    if all_records: return
    
    random.seed(42)
    all_records = [] 
    
    for i in range(100):
        hours_ago = random.randint(1, 240) 
        create_time = datetime.now() - timedelta(hours=hours_ago)
        
        temp_is_expired = (datetime.now() - create_time).days > 3
        if temp_is_expired:
            is_transported = random.choices([True, False], weights=[0.9, 0.1])[0]
        else:
            is_transported = random.choice([True, False])

        dept_id = random.randint(0, len(dept_names)-1)
        loc_id = random.randint(0, len(loc_names)-1)
        user_id = random.randint(0, len(user_names)-1)

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

generate_data() 


# =========================================================
# 🟢 2. 結算頁面 View
# =========================================================
@login_required
def settlement_view(request):
    
    if not all_records: generate_data()

    f_start_date = request.GET.get('start_date', '')
    f_end_date = request.GET.get('end_date', '')
    f_location = request.GET.get('location', '')
    f_dept = request.GET.get('dept', '')
    f_weigher = request.GET.get('weigher', '')
    sort_by = request.GET.get('sort_by', 'newest')

    filtered_records = []
    for r in all_records:
        match = True
        if f_start_date:
            try:
                if r['create_time'] < datetime.strptime(f_start_date, '%Y-%m-%d'): match = False
            except: pass
        if f_end_date:
            try:
                if r['create_time'] >= datetime.strptime(f_end_date, '%Y-%m-%d') + timedelta(days=1): match = False
            except: pass

        if f_location and str(r['location']['id']) != str(f_location): match = False
        if f_dept and str(r['department']['id']) != str(f_dept): match = False
        if f_weigher and str(r['creator']['id']) != str(f_weigher): match = False

        if match:
            filtered_records.append(r)

    if sort_by == 'newest':
        filtered_records.sort(key=lambda x: x['create_time'], reverse=True)
    elif sort_by == 'oldest':
        filtered_records.sort(key=lambda x: x['create_time'], reverse=False)
    elif sort_by == 'weight_desc':
        filtered_records.sort(key=lambda x: x['weight'], reverse=True)
    elif sort_by == 'weight_asc':
        filtered_records.sort(key=lambda x: x['weight'], reverse=False)

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

    now = datetime.now()
    for record in page_obj:
        is_expired = (now - record['create_time']).days > 3
        record['is_expired'] = is_expired
        record['can_delete'] = (not is_expired) and (not record['is_transported'])

    context = {
        'page_obj': page_obj,
        'departments': departments_list,
        'locations': locations_list,
        'weighers': weighers_list,
        'process_agencies': process_agencies,
        'clear_agencies': clear_agencies,
        'start_date': f_start_date,
        'end_date': f_end_date,
        'selected_location': f_location,
        'selected_dept': f_dept,
        'selected_weigher': f_weigher,
        'current_sort': sort_by,
        'current_page_size': page_size,
    }
    
    return render(request, 'dashboard_extension/settlement_fragment.html', context)


# =========================================================
# 🆕 3. 行動工作站 & API (已修復 Global 錯誤)
# =========================================================

@login_required
def mobile_station_view(request):
    # 這裡將 locations_list 傳給前端，解決下拉選單沒資料的問題
    context = { 'locations': locations_list }
    return render(request, 'dashboard_extension/mobile/station.html', context)

@require_POST
@login_required
def delete_records_api(request):
    # 🔴 修正：global 必須放在第一行
    global all_records 
    try:
        data = json.loads(request.body)
        record_ids = list(map(str, data.get('ids', [])))
        
        before_len = len(all_records)
        all_records = [r for r in all_records if str(r['id']) not in record_ids]
        return JsonResponse({'status': 'success', 'deleted_count': before_len - len(all_records)})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

@require_POST
def record_waste_api(request):
    # 🔴 修正：global 必須放在第一行
    global all_records
    try:
        data = json.loads(request.body)
        loc_id = int(data.get('location_id', 0))
        weight = float(data.get('weight', 0))
        loc_name = next((loc['name'] for loc in locations_list if loc['id'] == loc_id), "未知地點")
        
        new_record = {
            'id': len(all_records) + 1000,
            'create_time': datetime.now(),
            'update_time': datetime.now(),
            'weight': weight,
            'is_transported': False,
            'department': departments_list[0],
            'location': {'id': loc_id, 'name': loc_name},
            'creator': weighers_list[0],
            'updater': {'name': None},
        }
        
        all_records.insert(0, new_record)
        return JsonResponse({'status': 'success'})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)