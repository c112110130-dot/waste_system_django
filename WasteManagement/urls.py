from django.urls import path
from WasteManagement import views

# 🌟 宣告 App 的命名空間，對應總路由中的設定
app_name = 'WasteManagement'

urlpatterns = [
    # -------------------------------------------------------------------------
    # 1. API Endpoints (資料介面)
    # -------------------------------------------------------------------------
    path('api/get_data/', views.get_data, name='get_data'),
    path('api/batch_import/', views.batch_import, name='batch_import'),
    path('api/save_data/', views.save_data, name='save_data'),
    path('api/delete_data/', views.delete_data, name='delete_data'),
    
    # --- 部門相關 API ---
    path('api/department/month_status/', views.get_month_status, name='get_month_status'),
    path('api/department/data/', views.get_department_data, name='get_department_data'),
    path('api/department/save/', views.save_department_data, name='save_department_data'),
    path('api/department/delete/', views.delete_department_data, name='delete_department_data'),
    path('api/department/batch_import/', views.batch_import_departments, name='batch_import_departments'),
    path('api/department/export/', views.export_department_data, name='export_department_data'),
    
    # --- 視覺化圖表 API ---
    path('api/visualize_dept/config/', views.visualize_department_config, name='visualize_department_config'),
    path('api/visualize_dept/data/', views.visualize_department_data, name='visualize_department_data'),
    
    # --- 載運與定點 API ---
    path('api/record_waste/', views.record_waste_api, name='api_record_waste'),
    # 🌟 關鍵修正：將 name 改為 'delete_batches_api' 以完美對接 transportation.html 🌟
    path('api/delete_batches/', views.delete_batches_api, name='delete_batches_api'),
    path('api/locations/', views.locations_api, name='locations_api'),
    path('api/location/save/', views.api_save_location, name='api_save_location'),
    path('api/location/delete/', views.api_delete_location, name='api_delete_location'),
    path('api/agency/save/', views.api_save_agency, name='api_save_agency'),
    path('api/agency/delete/', views.api_delete_agency, name='api_delete_agency'),

    # --- 結算與刪除紀錄 API ---
    path('api/delete_records/', views.delete_records_api, name='api_delete_records'),
    path('api/delete_alert_records/', views.api_delete_alert_records, name='api_delete_alert_records'),

    # -------------------------------------------------------------------------
    # 2. User Interface URLs (介面呈現)
    # -------------------------------------------------------------------------
    # --- 基礎索引頁 ---
    path('database/', views.database_index, name='database_index'),
    path('department/', views.db_department_index, name='db_department_index'),
    
    # --- 報表管理 ---
    path('visualize/', views.visualize_index, name='visualize_index'),
    path('visualize_dept/', views.visualize_department_index, name='visualize_department_index'),
    
    # --- 廢棄物結算核心 ---
    path('settlement/', views.settlement_view, name='settlement_view'),
    path('settlement_process/', views.settlement_process, name='settlement_process'),
    
    # --- 警報紀錄管理 ---
    path('alert_record/', views.alert_record_view, name='alert_record'),
    
    # --- 載運紀錄檢視 ---
    path('transportation/', views.transportation_view, name='transportation_view'),
    
    # --- 行動工作站 (手機版) ---
    path('mobile/', views.mobile_station_view, name='mobile_station'),
    
    # --- 秤重定點管理 ---
    path('location/', views.location_management_view, name='location_management'),
    
    # --- QR Code 列印頁面 ---
    path('qrcode/', views.qrcode_print_view, name='qrcode_print'),
]