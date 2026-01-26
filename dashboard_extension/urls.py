from django.urls import path
from . import views

app_name = 'dashboard'

urlpatterns = [
    # 1. 頁面類 (負責顯示畫面)
    path('settlement/', views.settlement_view, name='settlement_page'),
    path('mobile/', views.mobile_station_view, name='mobile_station'),

    # 2. 功能類 (負責刪除、存檔，看不到畫面但很重要)
    path('api/delete_records/', views.delete_records_api, name='api_delete_records'),
    path('api/record_waste/', views.record_waste_api, name='api_record_waste'),
]