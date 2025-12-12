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
    path('history/export', views.history_export, name='history_export'),
    path('connect/upload', views.connect_upload, name='connect_upload'),
    path('devices', views.get_devices, name='get_devices'),  # Public device list
    # Admin API endpoints
    path('admin/login', views.admin_login, name='admin_login'),
    path('admin/devices', views.admin_devices, name='admin_devices'),
    path('admin/devices/<str:device_id>/stats', views.admin_device_stats, name='admin_device_stats'),
    path('admin/devices/<str:mac_address>/rename', views.admin_rename_device, name='admin_rename_device'),
    path('admin/devices/<str:device_id>/delete', views.admin_delete_device, name='admin_delete_device'),
    path('admin/devices/merge', views.admin_merge_device, name='admin_merge_device'),
    # AI Assistant endpoint
    path('ai/chat', views.ai_chat, name='ai_chat'),
    # Debug endpoint (remove in production if needed)
    path('debug/build-info', views.debug_build_info, name='debug_build_info'),
]

