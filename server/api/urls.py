"""
URL configuration for api app
"""
from django.urls import path
from . import views

urlpatterns = [
    # API endpoints
    # Force reload 2
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
    path('admin/devices/<str:mac_address>/customize', views.admin_customize_device, name='admin_customize_device'),
    path('admin/devices/<str:device_id>/delete', views.admin_delete_device, name='admin_delete_device'),
    path('admin/devices/merge', views.admin_merge_device, name='admin_merge_device'),
    # MAC Address Whitelist Management endpoints
    path('admin/whitelist/status', views.admin_whitelist_status, name='admin_whitelist_status'),
    path('admin/whitelist/toggle', views.admin_whitelist_toggle, name='admin_whitelist_toggle'),
    path('admin/whitelist/devices', views.admin_whitelist_devices, name='admin_whitelist_devices'),
    path('admin/whitelist/devices/<str:mac_address>', views.admin_whitelist_set, name='admin_whitelist_set'),
    path('admin/whitelist/all', views.admin_whitelist_all, name='admin_whitelist_all'),
    path('admin/whitelist/add', views.admin_whitelist_add_mac, name='admin_whitelist_add_mac'),
    # AI Assistant endpoint
    path('ai/chat', views.ai_chat, name='ai_chat'),
    # Annotation endpoints
    path('admin/rooms', views.get_room_codes, name='get_room_codes'),
    path('annotation/status', views.annotation_status, name='annotation_status'),
    path('annotation/run', views.annotation_run, name='annotation_run'),
    # Annotated data analytics API (Admin Panel)
    path('annotated/series', views.annotated_series, name='annotated_series'),
    path('annotated/summary', views.annotated_summary, name='annotated_summary'),
    path('annotated/lessons', views.annotated_lessons, name='annotated_lessons'),
    path('annotated/heatmap', views.annotated_heatmap, name='annotated_heatmap'),
    # Debug endpoint (remove in production if needed)
    path('debug/build-info', views.debug_build_info, name='debug_build_info'),
]

