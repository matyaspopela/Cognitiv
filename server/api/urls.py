"""
URL configuration for api app
"""
from django.urls import path
from . import views

urlpatterns = [
    # API endpoints
    path('data', views.data_endpoint, name='data_endpoint'),  # GET and POST
    path('stats', views.get_stats, name='get_stats'),
    path('status', views.status_view, name='status'),
    path('history/series', views.history_series, name='history_series'),
    path('history/summary', views.history_summary, name='history_summary'),
    path('connect/upload', views.connect_upload, name='connect_upload'),
]

