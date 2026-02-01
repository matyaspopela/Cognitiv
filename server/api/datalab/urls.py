"""
DataLab URL Configuration
"""
from django.urls import path
from . import views

urlpatterns = [
    path('preview', views.preview_query, name='datalab_preview'),
    path('export', views.export_data, name='datalab_export'),
    path('presets', views.manage_presets, name='datalab_presets'),
    path('presets/<str:preset_id>', views.delete_preset, name='datalab_preset_delete'),
]
