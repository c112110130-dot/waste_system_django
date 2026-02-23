from django.urls import path
from . import views

app_name = 'dashboard'

urlpatterns = [
    # 1. 廢棄物結算 (單筆管理)
    path('settlement/', views.settlement_view, name='settlement_view'),
    
    # 2. 行動工作站 (手機版)
    path('mobile/', views.mobile_station_view, name='mobile_station'),
    
    # 3. 廢棄物載運管理紀錄 (整批管理)
    path('transportation/', views.transportation_view, name='transportation_view'),

    # 🟢 新增：處理結算表單送出的路由 (解決 NoReverseMatch 錯誤的關鍵)
    path('settlement_process/', views.settlement_process_view, name='settlement_process'),

    # --- API ---
    # 刪除單筆紀錄
    path('api/delete_records/', views.delete_records_api, name='api_delete_records'),
    # 新增單筆紀錄
    path('api/record_waste/', views.record_waste_api, name='api_record_waste'),
    # 刪除載運單
    path('api/delete_batches/', views.delete_batches_api, name='api_delete_batches'),
]