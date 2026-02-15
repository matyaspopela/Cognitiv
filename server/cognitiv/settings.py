"""
Django settings for cognitiv project.
IoT Environmental Monitoring System - Django Configuration
"""

from pathlib import Path
import os

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env file from project root (parent of server directory) for local development
# In production (Render), environment variables are set directly - DO NOT load .env
# Only load .env files when NOT running on Render (local development)
is_production = os.getenv('RENDER') is not None or os.getenv('RENDER_EXTERNAL_HOSTNAME') is not None

if not is_production:
    try:
        from dotenv import load_dotenv
        # Primary: Load from project root (parent of server directory)
        env_path = BASE_DIR.parent / '.env'
        if env_path.exists():
            load_dotenv(env_path, override=True)
            print(f"[OK] Loaded environment variables from {env_path} (root .env file)")
        else:
            # Fallback: Try loading from server directory (for flexibility)
            env_path_server = BASE_DIR / '.env'
            if env_path_server.exists():
                load_dotenv(env_path_server, override=True)
                print(f"[OK] Loaded environment variables from {env_path_server}")
            else:
                print(f"[INFO] No .env file found at {env_path} or {env_path_server}. Using system environment variables.")
    except ImportError:
        # python-dotenv not installed - skip .env loading (production mode)
        pass
else:
    print(f"[INFO] Production environment detected (Render). Using Render environment variables only.")

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    if os.getenv('RENDER'):
        raise ValueError("DJANGO_SECRET_KEY must be set in production")
    # Allow insecure key ONLY for local development
    SECRET_KEY = 'django-insecure-dev-only-replace-in-production'

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'

# Restrict allowed hosts - add your domains here
ALLOWED_HOSTS = [
    'cognitiv.onrender.com',
    'cognitiv-testing.onrender.com',  # Explicitly add testing domain
    'localhost',
    '127.0.0.1',
]

# Add Render external hostname if available (auto-configuration for PR previews/testing)
RENDER_EXTERNAL_HOSTNAME = os.getenv('RENDER_EXTERNAL_HOSTNAME')
if RENDER_EXTERNAL_HOSTNAME:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)

# Allow any host in debug mode for local development
if DEBUG:
    ALLOWED_HOSTS.append('*')

# Application definition
INSTALLED_APPS = [
    'django.contrib.auth',           # Authentication framework
    'django.contrib.contenttypes',   # Required by auth
    'django.contrib.staticfiles',    # For serving static HTML files
    'django.contrib.sessions',       # For admin session management
    'corsheaders',                   # CORS support
    'api',                           # Main API application
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',  # For admin session management
    'django.middleware.common.CommonMiddleware',
    'api.middleware.DisableCSRFForAPI',  # Disable CSRF for API endpoints (before CSRF middleware)
    'django.middleware.csrf.CsrfViewMiddleware',  # CSRF protection (views use csrf_exempt where needed)
    'django.contrib.auth.middleware.AuthenticationMiddleware',  # Required for request.user
    'api.middleware.api_key.ApiKeyMiddleware',  # API key authentication for devices
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# Add WhiteNoise middleware if available (for production)
try:
    import whitenoise
    MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')
except ImportError:
    # WhiteNoise not installed - will use Django's static file serving in development
    pass

# CORS settings - restrict to known origins in production
CORS_ALLOW_ALL_ORIGINS = DEBUG  # Only allow all origins in debug mode
CORS_ALLOWED_ORIGINS = [
    'https://cognitiv.onrender.com',
    'https://cognitiv-testing.onrender.com',  # Explicitly add testing domain
    'http://localhost:5173',
    'http://localhost:8000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:8000',
]

# Add Render external hostname to CORS and CSRF settings
if RENDER_EXTERNAL_HOSTNAME:
    origin = f'https://{RENDER_EXTERNAL_HOSTNAME}'
    if origin not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS.append(origin)

CORS_ALLOW_CREDENTIALS = True  # Allow cookies for session-based auth

# CSRF settings for API endpoints (IoT devices don't send CSRF tokens or Referer headers)
CSRF_TRUSTED_ORIGINS = ['https://cognitiv.onrender.com', 'https://cognitiv-testing.onrender.com', 'http://localhost:8000']

# Add Render external hostname to CSRF trusted origins
if RENDER_EXTERNAL_HOSTNAME:
    origin = f'https://{RENDER_EXTERNAL_HOSTNAME}'
    if origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(origin)

# Secure cookies in production (HTTPS required)
CSRF_COOKIE_SECURE = not DEBUG
CSRF_USE_SESSIONS = False
CSRF_COOKIE_HTTPONLY = False

ROOT_URLCONF = 'cognitiv.urls'

# Templates not used (serving static HTML files directly)
TEMPLATES = []

WSGI_APPLICATION = 'cognitiv.wsgi.application'

# Database - SQLite for Django auth, MongoDB for sensor data
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

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
SESSION_COOKIE_SECURE = not DEBUG  # Secure cookies in production
