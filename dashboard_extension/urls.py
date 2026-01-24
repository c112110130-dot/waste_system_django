from django.urls import path
from . import views

app_name = 'dashboard'

urlpatterns = [
    # 這就是你的結算頁面網址
    path('settlement/', views.settlement_view, name='settlement_page'),
]