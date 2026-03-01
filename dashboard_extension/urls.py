from django.urls import path
from . import views

app_name = 'dashboard'

urlpatterns = [
    # 這就是你的結算頁面網址
    path('settlement/', views.settlement_view, name='settlement_page'),
    path('delete_records/', views.delete_records_api, name='delete_records'),
    path('settlement_process/', views.settlement_process, name='settlement_process'),
    # 2. 行動工作站 (手機版)
    path('mobile/', views.mobile_station_view, name='mobile_station'),
    
    # 3. 廢棄物載運管理紀錄 (整批管理)
    path('transportation/', views.transportation_view, name='transportation_view'),
    # --- API ---
    # 刪除單筆紀錄
    path('api/delete_records/', views.delete_records_api, name='api_delete_records'),
    # 新增單筆紀錄
    path('api/record_waste/', views.record_waste_api, name='api_record_waste'),
    # 刪除載運單
    path('api/delete_batches/', views.delete_batches_api, name='api_delete_batches'),
    path('api/locations/', views.locations_api, name='locations_api'),
    
    path('api/location/save/', views.api_save_location, name='api_save_location'),
    path('api/location/delete/', views.api_delete_location, name='api_delete_location'),
    
    # 新增：儲存機構 (由 JavaScript fetch 呼叫)
    path('api/agency/save/', views.api_save_agency, name='api_save_agency'),
    path('api/agency/delete/', views.api_delete_agency, name='api_delete_agency'),

    path('location/', views.location_management_view, name='location_management'),
]