"""
URL configuration for cognitiv project.
"""
from django.urls import path, include, re_path
from api import views

urlpatterns = [
    # API endpoints (must come before catch-all)
    path('api/', include('api.urls')),
    # React app catch-all (serves index.html for all non-API routes)
    re_path(r'^(?!api/).*$', views.serve_react_app, name='react_app'),
]
