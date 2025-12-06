"""
URL configuration for cognitiv project.
"""
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from api import views

urlpatterns = [
    # API endpoints (must come before catch-all)
    path('api/', include('api.urls')),
    # Serve React assets (JS, CSS, etc.) - must come before catch-all
    re_path(r'^assets/(?P<asset_path>.*)$', views.serve_react_asset, name='react_asset'),
    # React app catch-all (serves index.html for all non-API routes)
    re_path(r'^(?!api/).*$', views.serve_react_app, name='react_app'),
]

# Serve React assets directly in development
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
