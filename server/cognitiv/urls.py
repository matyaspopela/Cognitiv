"""
URL configuration for cognitiv project.
"""
from django.urls import path, include
from api import views

urlpatterns = [
    # Static HTML pages
    path('', views.home, name='home'),
    path('dashboard', views.dashboard, name='dashboard'),
    path('history', views.history, name='history'),
    path('connect', views.connect, name='connect'),
    # API endpoints
    path('', include('api.urls')),
]
