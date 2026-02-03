from django.urls import path
from . import views

urlpatterns = [
    path('export', views.export_data, name='datalab_export'),
    path('preview', views.preview_query, name='datalab_preview'),
]