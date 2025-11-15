"""
Django settings for cognitiv project.
IoT Environmental Monitoring System - Django Configuration
"""

from pathlib import Path
import os

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'django-insecure-#rpbd^n-j2y4ow1dy%uk=n_c6a5iti0y32sb47n1j%09y)y&3n')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'

ALLOWED_HOSTS = ['*']  # Configure appropriately for production

# Application definition
INSTALLED_APPS = [
    'django.contrib.staticfiles',  # For serving static HTML files
    'corsheaders',  # CORS support
    'api',  # Main API application
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',  # CSRF protection (views use csrf_exempt where needed)
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# CORS settings
CORS_ALLOW_ALL_ORIGINS = True  # Configure appropriately for production

ROOT_URLCONF = 'cognitiv.urls'

# Templates not used (serving static HTML files directly)
TEMPLATES = []

WSGI_APPLICATION = 'cognitiv.wsgi.application'

# Database - Not using Django ORM (using MongoDB via pymongo)
DATABASES = {}

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = os.getenv('LOCAL_TIMEZONE', 'Europe/Prague')
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATICFILES_DIRS = [
    BASE_DIR / 'static',
]
