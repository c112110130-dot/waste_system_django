from django.urls import path
from . import views

urlpatterns = [
    # 設定網址：http://127.0.0.1:8000/access/dashboard/
    path('dashboard/', views.management_dashboard, name='access_dashboard'),
]