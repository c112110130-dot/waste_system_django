"""
URL configuration for MedicalWasteManagementSystem project.
"""
from django.contrib import admin
from django.urls import path, include
import Main.views

urlpatterns = [
    # Global API endpoints
    path('api/time/', Main.views.server_time, name='server_time'), 
    path('api/extended-chart-data/', Main.views.extended_chart_data, name='extended_chart_data'),
    
    # Main menu interfaces & admin
    path('', Main.views.index, name='main'),
    path('admin/', admin.site.urls),
    
    # Module interfaces & APIs
    path('account/', include('Main.urls', namespace='account'), name='account'),
    path('transportation/', include('WasteTransportation.urls', namespace='transportation'), name='transportation'),
    
    # 🌟 關鍵修正：將入口改為 WasteManagement 並統一命名空間 🌟
    # 這樣才能對應到網址 http://127.0.0.1:8000/WasteManagement/ 
    # 並且讓 {% url 'WasteManagement:...' %} 標籤生效
    path('WasteManagement/', include('WasteManagement.urls', namespace='WasteManagement'), name='WasteManagement'),
    
    # 為了保險，如果你有些地方還是用舊的 'management/' 網址，可以留這行當備用出口
    path('management/', include('WasteManagement.urls', namespace='management'), name='management_legacy'),
    
    path('prediction/', include('WastePrediction.urls', namespace='prediction'), name='prediction'),
    path('dashboard/', include('dashboard_extension.urls', namespace='dashboard'), name='dashboard'), # Our new dashboard extension
]
