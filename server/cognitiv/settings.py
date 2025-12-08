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
    'django.contrib.sessions',  # For admin session management
    'corsheaders',  # CORS support
    'api',  # Main API application
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'api.middleware.DisableCSRFForAPI',  # Disable CSRF for API endpoints (before CSRF middleware)
    'django.middleware.csrf.CsrfViewMiddleware',  # CSRF protection (views use csrf_exempt where needed)
    'django.contrib.sessions.middleware.SessionMiddleware',  # For admin session management
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# Add WhiteNoise middleware if available (for production)
try:
    import whitenoise
    MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')
except ImportError:
    # WhiteNoise not installed - will use Django's static file serving in development
    pass

# CORS settings
CORS_ALLOW_ALL_ORIGINS = True  # Configure appropriately for production
CORS_ALLOW_CREDENTIALS = True  # Allow cookies for session-based auth

# CSRF settings for API endpoints (IoT devices don't send CSRF tokens or Referer headers)
CSRF_TRUSTED_ORIGINS = ['https://cognitiv.onrender.com', 'http://localhost:8000']
# Allow requests without Referer header for API endpoints (needed for IoT devices)
CSRF_COOKIE_SECURE = False  # Set to True in production with HTTPS
CSRF_USE_SESSIONS = False
CSRF_COOKIE_HTTPONLY = False

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
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# React build directory - handle both local and Render paths
REACT_BUILD_DIR = None
possible_build_dirs = [
    BASE_DIR.parent / 'frontend' / 'dist',
    BASE_DIR.parent.parent / 'frontend' / 'dist',
]

for build_dir in possible_build_dirs:
    if os.path.exists(build_dir):
        REACT_BUILD_DIR = build_dir
        break

# Default fallback if none found
if REACT_BUILD_DIR is None:
    REACT_BUILD_DIR = BASE_DIR.parent / 'frontend' / 'dist'

STATICFILES_DIRS = [
    BASE_DIR / 'static',
]

# Only add React build directory if it exists
if os.path.exists(REACT_BUILD_DIR):
    STATICFILES_DIRS.append(REACT_BUILD_DIR)

# WhiteNoise configuration for efficient static file serving
# Use CompressedStaticFilesStorage for React apps (no manifest required) if available
try:
    import whitenoise
    STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'
    # WhiteNoise additional configuration
    WHITENOISE_ROOT = None  # We'll serve React assets via custom view
    WHITENOISE_USE_FINDERS = True  # Use Django's static file finders
except ImportError:
    # WhiteNoise not installed - use default storage for development
    STATICFILES_STORAGE = 'django.contrib.staticfiles.storage.StaticFilesStorage'

# Session configuration for admin authentication
# Using signed cookies - no database or file storage needed
SESSION_ENGINE = 'django.contrib.sessions.backends.signed_cookies'
SESSION_COOKIE_AGE = 86400  # 24 hours
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_SECURE = False  # Set to True in production with HTTPS
