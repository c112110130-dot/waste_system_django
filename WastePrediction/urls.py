from django.urls import path

from WastePrediction import views

app_name = 'WastePrediction'
urlpatterns = [
    # API endpoints
    path('api/batch_import/', views.batch_import, name='batch_import'),
    path('api/save_data/', views.save_data, name='save_data'),
    path('api/delete_data/', views.delete_data, name='delete_data'),
    path('api/get_data/', views.get_data, name='get_data'),
    path('api/calculate_prediction/', views.calculate_prediction, name='calculate_prediction'),
    path('api/calculate_correlation/', views.calculate_correlation, name='calculate_correlation'),
    
    # User Interface URL (static/template)
    path('', views.prediction_index, name='prediction_index'),
]