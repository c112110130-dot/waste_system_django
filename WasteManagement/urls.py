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
]