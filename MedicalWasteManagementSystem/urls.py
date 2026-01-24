"""
URL configuration for MedicalWasteManagementSystem project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include

import Main.views

urlpatterns = [
    # Global API endpoints
    path('api/time/', Main.views.server_time, name='server_time'), # Get current time
    path('api/extended-chart-data/', Main.views.extended_chart_data, name='extended_chart_data'), # Get 24 months data
    
    # Main menu interfaces & admin
    path('', Main.views.index, name='main'),
    path('admin/', admin.site.urls),
    #path('access/', include('access_control.urls')),
    
    # Module interfaces & APIs
    path('account/', include('Main.urls', namespace='account'), name='account'),
    path('transportation/', include('WasteTransportation.urls', namespace='transportation'), name='transportation'),
    path('management/', include('WasteManagement.urls', namespace='management'), name='management'),
    path('prediction/', include('WastePrediction.urls', namespace='prediction'), name='prediction'),
    path('dashboard/', include('dashboard_extension.urls', namespace='dashboard'), name='dashboard'),
]
