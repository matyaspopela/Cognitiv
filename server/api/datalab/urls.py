"""
DataLab URL Configuration
"""
from django.urls import path
from . import views
from .filter_options import get_filter_options

urlpatterns = [
    path('preview', views.preview_query, name='datalab_preview'),
    path('export', views.export_data, name='datalab_export'),
    path('presets', views.manage_presets, name='datalab_presets'),
    path('presets/<str:preset_id>', views.delete_preset, name='datalab_preset_delete'),
    path('filter-options', get_filter_options, name='datalab_filter_options'),
]
