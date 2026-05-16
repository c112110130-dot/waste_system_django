from django.urls import path

from WasteManagement import views

app_name = 'WasteManagement'
urlpatterns = [
    # API endpoints
    path('api/get_data/', views.get_data, name='get_data'),
    path('api/batch_import/', views.batch_import, name='batch_import'),
    path('api/save_data/', views.save_data, name='save_data'),
    path('api/delete_data/', views.delete_data, name='delete_data'),
    path('api/department/month_status/', views.get_month_status, name='get_month_status'),
    path('api/department/data/', views.get_department_data, name='get_department_data'),
    path('api/department/save/', views.save_department_data, name='save_department_data'),
    path('api/department/delete/', views.delete_department_data, name='delete_department_data'),
    path('api/department/batch_import/', views.batch_import_departments, name='batch_import_departments'),
    path('api/department/export/', views.export_department_data, name='export_department_data'),
    path('api/visualize_dept/config/', views.visualize_department_config, name='visualize_department_config'),
    path('api/visualize_dept/data/', views.visualize_department_data, name='visualize_department_data'),
    
    # User Interface URLs (static/template)
    path('database/', views.database_index, name='database_index'),
    path('department/', views.db_department_index, name='db_department_index'),
    path('visualize/', views.visualize_index, name='visualize_index'),
    path('visualize_dept/', views.visualize_department_index, name='visualize_department_index'),
    path('settlement/', views.settlement_view, name='settlement_view'),
    path('delete_records/', views.delete_records_api, name='delete_records'),
    path('settlement_process/', views.settlement_process, name='settlement_process'),
    # 2. 行動工作站 (手機版)
    path('mobile/', views.mobile_station_view, name='mobile_station'),
    
    # 3. 廢棄物載運管理紀錄 (整批管理)
    path('transportation/', views.transportation_view, name='transportation_view'),
    # --- API ---
    # 刪除單筆紀錄
    path('api/delete_records/', views.delete_data, name='delete_data'),
    # 新增單筆紀錄
    path('api/record_waste/', views.record_waste_api, name='api_record_waste'),
    path('api/waste_record/<int:record_id>/', views.get_record_detail_api, name='api_get_record_detail'),
    # 刪除載運單
    path('api/delete_batches/', views.delete_records_api, name='delete_batches_api'),
    path('api/locations/', views.locations_api, name='locations_api'),
    
    path('api/location/save/', views.api_save_location, name='api_save_location'),
    path('api/location/delete/', views.api_delete_location, name='api_delete_location'),
    
    # 新增：儲存機構 (由 JavaScript fetch 呼叫)
    path('api/agency/save/', views.api_save_agency, name='api_save_agency'),
    path('api/agency/delete/', views.api_delete_agency, name='api_delete_agency'),

    path('location/', views.location_management_view, name='location_management'),
    # 6. QR Code 列印頁面
    path('qrcode/', views.qrcode_print_view, name='qrcode_print'),

    path('alert_record/', views.alert_record_view, name='alert_record'),
    path('api/delete_alert_records/', views.api_delete_alert_records, name='api_delete_alert_records'),
    path('api/save_alert_settings/', views.save_alert_settings, name='api_save_alert_settings'),
    path('generate_fake_data/', views.generate_fake_data, name='generate_fake_data'),
    path('api/random_transport/', views.random_transport_records, name='random_transport_api'),
    path('api/get_alert_settings/', views.get_alert_settings, name='api_get_alert_settings'),
    path('locate/<int:record_id>/', views.locate_record_view, name='locate_record'),
    path('api/last-month-alert-trend/', views.last_month_alert_trend, name='last_month_alert_trend'),
]