# Main app URL configuration
from django.urls import path
from . import views

app_name = 'account'

urlpatterns = [
    # Theme API
    path('api/set_theme/', views.set_theme, name='set_theme'),
    path('api/get_theme/', views.get_theme, name='get_theme'),

    # Account management API
    path('api/delete/<str:username>/', views.delete_account, name='delete_account'),
    
    # Database management API
    path('api/database/data/', views.get_department_waste_data, name='database_api_data'),
    path('api/database/waste-type/save/', views.save_waste_type, name='database_api_save_waste_type'),
    path('api/database/waste-type/delete/', views.delete_waste_types, name='database_api_delete_waste_types'),
    path('api/database/department/save/', views.save_department, name='database_api_save_department'),
    path('api/database/department/delete/', views.delete_departments, name='database_api_delete_departments'),

    # Account router (static/template URLs)
    path('login/', views.view_login, name='login'),
    path('logout/', views.view_logout, name='logout'),
    path('logout_guest/', views.logout_guest, name='logout_guest'),
    path('setting/', views.change_password, name='index_setting'),
    path('change_password/', views.change_password, name='change_password'),

    # Account management router (static/template URLs)
    path('manage/', views.view_account_manage_list, name='manage'),
    path('manage/<str:account_id>/', views.view_account_manage_info, name='manage_info'),
    path('register/', views.view_account_register, name='register'),

    # Database setting router (static/template URLs)
    path('database/', views.view_database, name='database'),
   
]