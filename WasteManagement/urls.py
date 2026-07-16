from django.urls import path
from . import views

# 🌟 統一設定為 'management' 以相容所有 HTML 範本
app_name = 'management'

urlpatterns = [
    # 頁面 UI
    path('database/', views.database_index, name='database_index'),
    path('department/', views.db_department_index, name='db_department_index'),
    path('visualize/', views.visualize_index, name='visualize_index'),
    path('visualize_dept/', views.visualize_department_index, name='visualize_department_index'),
    path('settlement/', views.settlement_view, name='settlement_view'),
    path('transportation/', views.transportation_view, name='transportation_view'),
    path('location/', views.location_management_view, name='location_management'),
    path('qrcode/', views.qrcode_print_view, name='qrcode_print'),
    path('alert_record/', views.alert_record_view, name='alert_record'),
    path('mobile/', views.mobile_station_view, name='mobile_station'),

    # 結算與刪除 API
    path('settlement_process/', views.settlement_process, name='settlement_process'),
    path('api/delete_records/', views.delete_records_api, name='api_delete_records'),
    path('api/delete_batches/', views.delete_records_api, name='delete_batches_api'), # 對應 transportation.html

    # 核心 API
    path('api/get_data/', views.get_data, name='get_data'),
    path('api/save_data/', views.save_data, name='save_data'),
    path('api/delete_data/', views.delete_data, name='delete_data'),
    
    # 部門與手機 API
    path('api/department/month_status/', views.get_month_status, name='get_month_status'),
    path('api/department/data/', views.get_department_data, name='get_department_data'),
    path('api/record_waste/', views.record_waste_api, name='api_record_waste'),
    path('api/visualize_dept/config/', views.visualize_department_config, name='visualize_department_config'),
    path('api/location/save/', views.api_save_location, name='api_save_location'),
    
    path('api/delete_alert_records/', views.api_delete_alert_records, name='api_delete_alert_records'),
    path('api/save_alert_settings/', views.save_alert_settings, name='api_save_alert_settings'),
    path('api/get_alert_settings/', views.get_alert_settings, name='api_get_alert_settings'),
    
    # 修正後的名稱
    path('api/last_month_alert_trend/', views.last_month_alert_trend, name='get_alert_trend_data'),
    
    # 請確保加上這條，以便補齊下方的監控表格更新功能
    path('api/get_alert_table/', views.get_alert_table, name='get_alert_table'),
]