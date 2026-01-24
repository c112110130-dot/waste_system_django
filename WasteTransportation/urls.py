from django.urls import path
from WasteTransportation import views

app_name = 'WasteTransportation'
urlpatterns = [
    # API endpoints
    path('api/get_manifests/', views.get_manifests, name='get_manifests'),
    path('api/get_manifest_detail/', views.get_manifest_detail, name='get_manifest_detail'),
    path('api/get_statistics/', views.get_statistics, name='get_statistics'),
    path('api/get_field_options/', views.get_field_options, name='get_field_options'),
    path('api/toggle_visibility/', views.toggle_manifest_visibility, name='toggle_manifest_visibility'),
    path('api/batch_import/', views.batch_import, name='batch_import'),
    path('api/import_manifests/', views.import_manifests, name='import_manifests'),
    path('api/get_existing_manifest_data/', views.get_existing_manifest_data, name='get_existing_manifest_data'),
    path('api/get_matching_count/', views.get_matching_count, name='get_matching_count'),
    path('api/get_matching_manifests/', views.get_matching_manifests, name='get_matching_manifests'),
    path('api/bulk_remove/', views.bulk_remove, name='bulk_remove'),
    path('api/bulk_remove_specific/', views.bulk_remove_specific, name='bulk_remove_specific'),
    path('api/get_filtered_field_options/', views.get_filtered_field_options, name='get_filtered_field_options'),
    
    # User Interface URLs (static/template)
    path('', views.transportation_index, name='transportation_index'),
]