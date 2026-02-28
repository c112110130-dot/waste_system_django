from django.shortcuts import render, redirect
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from datetime import datetime, timedelta
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
import random
import json

# =========================================================
# 1. 基礎設定與模擬資料
# =========================================================

dept_names = ['病理檢驗部', '急診室', '放射科', '住院部', '行政中心']
loc_names = ['B1 汙物室', '一樓大廳', '二樓護理站', '實驗室', '戶外暫存區']
user_names = ['王小明', '李大華', '張阿姨', 'Admin']
agency_names = ['大安環保公司', '綠色清運科技', '永續處理中心']
type_names = ['一般感染性廢棄物', '病理廢棄物', '尖銳器具', '化學廢棄物']

# 💡 已經幫您優化：讓假資料的 ID 從 1 開始編號，這樣新增時數字就能完美銜接了！
departments_list = [{'id': i, 'name': n} for i, n in enumerate(dept_names, 1)]
locations_list = [{'id': i, 'name': n} for i, n in enumerate(loc_names, 1)]
weighers_list = [{'id': i, 'name': n} for i, n in enumerate(user_names, 1)]
process_agencies = [{'id': i, 'name': n} for i, n in enumerate(agency_names, 1)]
clear_agencies = [{'id': i, 'name': n} for i, n in enumerate(agency_names, 1)]
waste_types_list = [{'id': i, 'name': n} for i, n in enumerate(type_names, 1)]

all_records = []
transport_batches = [] 

def generate_data():
    global all_records
    if all_records: return
    random.seed(42)
    all_records = [] 
    for i in range(150): 
        hours_ago = random.randint(1, 240) 
        create_time = datetime.now() - timedelta(hours=hours_ago)
        is_transported = random.choices([True, False], weights=[0.8, 0.2])[0]
        fake_record = {
            'id': i + 1,
            'create_time': create_time,
            'weight': round(random.uniform(0.5, 25.0), 2),
            'is_transported': is_transported,
            'waste_type': waste_types_list[random.randint(0, len(waste_types_list) - 1)],
            'department': departments_list[random.randint(0, 4)],
            'location':   locations_list[random.randint(0, 4)],
            'creator':    weighers_list[random.randint(0, 3)],
            'updater':    {'name': '系統管理員'},
            'update_time': datetime.now() if is_transported else None,
        }
        all_records.append(fake_record)
    generate_transport_batches()

def generate_transport_batches():
    global transport_batches
    transport_batches = []
    transported_items = [r for r in all_records if r['is_transported']]
    batch_id_counter = 202601001
    current_idx = 0
    while current_idx < len(transported_items):
        batch_size = random.randint(3, 8)
        batch_items = transported_items[current_idx : current_idx + batch_size]
        if not batch_items: break
        total_weight = sum(item['weight'] for item in batch_items)
        settle_time = batch_items[0]['create_time'] + timedelta(hours=2)
        batch_record = {
            'id': f"TR-{batch_id_counter}",
            'settle_time': settle_time,
            'settler': weighers_list[random.randint(0, 3)],
            'clear_agency': clear_agencies[random.randint(0, 2)],
            'process_agency': process_agencies[random.randint(0, 2)],
            'total_weight': round(total_weight, 2),
            'items': batch_items,
            'item_count': len(batch_items)
        }
        transport_batches.append(batch_record)
        batch_id_counter += 1
        current_idx += batch_size

generate_data()

# =========================================================
# 2. 結算頁面 View
# =========================================================
@login_required
def settlement_view(request):
    if not all_records: generate_data()
    f_start_date = request.GET.get('start_date', '')
    f_end_date = request.GET.get('end_date', '')
    f_location = request.GET.get('location', '')
    f_dept = request.GET.get('dept', '')
    f_weigher = request.GET.get('weigher', '')
    f_waste_type = request.GET.get('waste_type', '') 
    
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
        if f_waste_type and str(r['waste_type']['id']) != str(f_waste_type): match = False
        
        if match: filtered_records.append(r)

    if sort_by == 'newest': filtered_records.sort(key=lambda x: x['create_time'], reverse=True)
    elif sort_by == 'oldest': filtered_records.sort(key=lambda x: x['create_time'], reverse=False)
    elif sort_by == 'weight_desc': filtered_records.sort(key=lambda x: x['weight'], reverse=True)
    elif sort_by == 'weight_asc': filtered_records.sort(key=lambda x: x['weight'], reverse=False)

    try: page_size = int(request.GET.get('page_size', '10'))
    except: page_size = 10
    
    paginator = Paginator(filtered_records, page_size)
    page_obj = paginator.get_page(request.GET.get('page', 1))

    context = {
        'page_obj': page_obj, 'departments': departments_list, 'locations': locations_list,
        'weighers': weighers_list, 
        'waste_types': waste_types_list, 
        'start_date': f_start_date, 'end_date': f_end_date,
        'selected_location': f_location, 'selected_dept': f_dept, 'selected_weigher': f_weigher,
        'selected_waste_type': f_waste_type, 
        'current_sort': sort_by, 'current_page_size': page_size,
    }
    return render(request, 'dashboard_extension/settlement_fragment.html', context)

# =========================================================
# 3. 廢棄物載運管理紀錄
# =========================================================
@login_required
def transportation_view(request):
    if not transport_batches: generate_data()
    f_start_date = request.GET.get('start_date', '')
    f_end_date = request.GET.get('end_date', '')
    f_agency = request.GET.get('agency', '') 
    sort_by = request.GET.get('sort_by', 'newest')
    try: page_size = int(request.GET.get('page_size', '10'))
    except ValueError: page_size = 10
    
    filtered_batches = []
    for batch in transport_batches:
        match = True
        if f_start_date:
            try:
                if batch['settle_time'] < datetime.strptime(f_start_date, '%Y-%m-%d'): match = False
            except: pass
        if f_end_date:
            try:
                if batch['settle_time'] >= datetime.strptime(f_end_date, '%Y-%m-%d') + timedelta(days=1): match = False
            except: pass
        if f_agency:
            if str(batch['clear_agency']['id']) != f_agency and str(batch['process_agency']['id']) != f_agency:
                match = False
        if match: filtered_batches.append(batch)

    total_weight_sum = sum(batch['total_weight'] for batch in filtered_batches)

    if sort_by == 'newest': filtered_batches.sort(key=lambda x: x['settle_time'], reverse=True)
    elif sort_by == 'oldest': filtered_batches.sort(key=lambda x: x['settle_time'], reverse=False)
    elif sort_by == 'weight_desc': filtered_batches.sort(key=lambda x: x['total_weight'], reverse=True)
    elif sort_by == 'weight_asc': filtered_batches.sort(key=lambda x: x['total_weight'], reverse=False)

    paginator = Paginator(filtered_batches, page_size) 
    page_obj = paginator.get_page(request.GET.get('page', 1))

    context = {
        'page_obj': page_obj, 'clear_agencies': clear_agencies, 
        'start_date': f_start_date, 'end_date': f_end_date,
        'selected_agency': f_agency, 'current_page_size': page_size,
        'current_sort': sort_by,
        'total_weight_sum': round(total_weight_sum, 2), 
    }
    return render(request, 'dashboard_extension/transportation.html', context)

# =========================================================
# 4. 行動工作站 & API 
# =========================================================
@login_required
def mobile_station_view(request):
    context = { 'locations': locations_list }
    return render(request, 'dashboard_extension/mobile/station.html', context)

@require_POST
@login_required
def delete_records_api(request):
    global all_records 
    try:
        data = json.loads(request.body)
        record_ids = list(map(str, data.get('ids', [])))
        before_len = len(all_records)
        all_records = [r for r in all_records if str(r['id']) not in record_ids]
        generate_transport_batches()
        return JsonResponse({'status': 'success', 'deleted_count': before_len - len(all_records)})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

@require_POST
@login_required
def delete_batches_api(request):
    global transport_batches
    try:
        data = json.loads(request.body)
        batch_ids = list(map(str, data.get('ids', [])))
        before_len = len(transport_batches)
        transport_batches = [b for b in transport_batches if str(b['id']) not in batch_ids]
        return JsonResponse({'status': 'success', 'deleted_count': before_len - len(transport_batches)})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

@require_POST
def record_waste_api(request):
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
            'waste_type': waste_types_list[0],
            'department': departments_list[0],
            'location': {'id': loc_id, 'name': loc_name},
            'creator': weighers_list[0],
            'updater': {'name': None},
        }
        all_records.insert(0, new_record)
        return JsonResponse({'status': 'success'})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

# =========================================================
# 5. 處理結算單送出
# =========================================================
@require_POST
@login_required
def settlement_process_view(request):
    global all_records, transport_batches
    
    # 1. 取得前端表單傳來的資料
    selected_ids_str = request.POST.get('selected_ids', '')
    process_agency_id = request.POST.get('process_agency')
    clear_agency_id = request.POST.get('clear_agency')
    
    if not selected_ids_str:
        return redirect('dashboard:settlement_view')
        
    selected_ids = selected_ids_str.split(',')
    
    # 2. 找出被選取的單筆廢棄物，並將狀態改為 "已載運"
    batch_items = []
    for r in all_records:
        if str(r['id']) in selected_ids and not r['is_transported']:
            r['is_transported'] = True
            r['update_time'] = datetime.now()
            batch_items.append(r)
            
    # 3. 如果有成功選取並更新項目，就產生一筆「載運批次紀錄」
    if batch_items:
        total_weight = sum(item['weight'] for item in batch_items)
        
        # 找出對應的機構名稱，如果找不到就預設第一間
        p_agency = next((a for a in process_agencies if str(a['id']) == process_agency_id), process_agencies[0])
        c_agency = next((a for a in clear_agencies if str(a['id']) == clear_agency_id), clear_agencies[0])
        
        # 動態產生載運單號 (例如 TR-20260223001)
        new_batch_id = f"TR-{datetime.now().strftime('%Y%m%d%H%M')}{random.randint(10, 99)}"
        
        batch_record = {
            'id': new_batch_id,
            'settle_time': datetime.now(),
            'settler': weighers_list[3], # 假設目前結算人員是 Admin
            'clear_agency': c_agency,
            'process_agency': p_agency,
            'total_weight': round(total_weight, 2),
            'items': batch_items,
            'item_count': len(batch_items)
        }
        
        # 將新單據插入到陣列最前面 (最新的在最上面)
        transport_batches.insert(0, batch_record)
        
    # 4. 處理完成後，重新導向回結算頁面
    return redirect('dashboard:settlement_view')

# =========================================================
# 6. 定點機構管理 (畫面)
# =========================================================
@login_required
def location_management_view(request):
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
    global locations_list
    try:
        data = json.loads(request.body)
        loc_id = data.get('id')
        name = data.get('name', '').strip()
        
        if not name: return JsonResponse({'success': False, 'error': '定點名稱不能為空'})
            
        if loc_id and loc_id != 'new':
            # 編輯現有資料
            for loc in locations_list:
                if str(loc['id']) == str(loc_id):
                    loc['name'] = name
                    break
        else:
            # 新增資料
            new_id = len(locations_list) + 1
            locations_list.insert(0, {'id': new_id, 'name': name})
            
        return JsonResponse({'success': True, 'message': '定點儲存成功'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

# =========================================================
# 6-2. API：刪除 定點
# =========================================================
@require_POST
@login_required
def api_delete_location(request):
    global locations_list
    try:
        data = json.loads(request.body)
        ids_to_delete = [str(i) for i in data.get('ids', [])]
        
        # 過濾掉被勾選刪除的 ID
        locations_list = [loc for loc in locations_list if str(loc['id']) not in ids_to_delete]
        
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

# =========================================================
# 6-3. API：儲存/編輯/新增 機構
# =========================================================
@require_POST
@login_required
def api_save_agency(request):
    global clear_agencies, process_agencies
    try:
        data = json.loads(request.body)
        raw_id = data.get('id') # 可能是 'new' 或是 'clear_1', 'process_2'
        name = data.get('name', '').strip()
        new_type = data.get('type', '')
        
        if not name: return JsonResponse({'success': False, 'error': '機構名稱不能為空'})
            
        if raw_id and raw_id != 'new':
            # 編輯現有資料：先將舊資料從原陣列抽出，再塞進新的分類陣列中
            old_type, actual_id = raw_id.split('_')[0], raw_id.split('_')[1]
            target_list = clear_agencies if old_type == 'clear' else process_agencies
            item_to_move = None
            
            for i, item in enumerate(target_list):
                if str(item['id']) == actual_id:
                    item_to_move = target_list.pop(i)
                    break
            
            if item_to_move:
                item_to_move['name'] = name
                # 根據選擇的新類型放入對應陣列
                if new_type == 'clear': clear_agencies.insert(0, item_to_move)
                else: process_agencies.insert(0, item_to_move)
        else:
            # 新增資料
            if new_type == 'clear':
                new_id = len(clear_agencies) + 1
                clear_agencies.insert(0, {'id': new_id, 'name': name})
            else:
                new_id = len(process_agencies) + 1
                process_agencies.insert(0, {'id': new_id, 'name': name})
                
        return JsonResponse({'success': True, 'message': '機構儲存成功'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

# =========================================================
# 6-4. API：刪除 機構
# =========================================================
@require_POST
@login_required
def api_delete_agency(request):
    global clear_agencies, process_agencies
    try:
        data = json.loads(request.body)
        raw_ids = data.get('ids', []) # ex: ['clear_1', 'process_2']
        
        # 解析出要刪除的清理機構 ID 和 處理機構 ID
        clear_ids = [i.split('_')[1] for i in raw_ids if i.startswith('clear_')]
        process_ids = [i.split('_')[1] for i in raw_ids if i.startswith('process_')]
        
        clear_agencies = [a for a in clear_agencies if str(a['id']) not in clear_ids]
        process_agencies = [a for a in process_agencies if str(a['id']) not in process_ids]
        
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})