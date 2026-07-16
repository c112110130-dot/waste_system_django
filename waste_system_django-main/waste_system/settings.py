"""
Django settings for waste_system project.
"""

import os
from pathlib import Path
from dotenv import load_dotenv  # 🌟 新增這一行：用來讀取 .env 檔案

# 🌟 新增這一行：正式載入同目錄下的 .env 環境變數設定
load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-local-fallback-key-for-development-xxxxx')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

# 🌟 1. 優先從 .env 讀取 ALLOWED_HOSTS 字串，讀不到就用預設值
allowed_hosts_env = os.environ.get('ALLOWED_HOSTS', '127.0.0.1,localhost')

# 🌟 2. 將字串用逗號切開成陣列，並自動「削掉」你剛剛在 .env 裡留下的多餘空格
ALLOWED_HOSTS = [host.strip() for host in allowed_hosts_env.split(',') if host.strip()]

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'core',  # 您的應用程式
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'waste_system.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / "core" /'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'waste_system.wsgi.application'

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
        'OPTIONS': {
            'timeout': 30,  # Units in seconds, default is 5
            'init_command': 'PRAGMA journal_mode=WAL;'  # Enable Write-Ahead Logging  
        }
    }
}

DATABASE_OPTIONS = {
    'timeout': 30,  # Timeout in seconds for database connections
}

# Upload Request limit
DATA_UPLOAD_MAX_NUMBER_FIELDS = 999999

# SQLite optimization settings
if 'default' in DATABASES and 'sqlite3' in DATABASES['default']['ENGINE']:
    DATABASES['default']['ATOMIC_REQUESTS'] = False
    DATABASES['default']['OPTIONS'] = {
        'timeout': 30,
        'isolation_level': None,  # Use autocommit mode
        'cached_statements': 1000
    }

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'file': {
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'debug.log',
        },
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        '': {
            'handlers': ['file', 'console'],
            'level': 'DEBUG',
            'propagate': True,
        },
    },
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    # { 'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator', },
    # { 'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', },
    # { 'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator', },
    # { 'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator', },
]

# Internationalization
LANGUAGE_CODE = 'zh-hant' # 改成繁體中文
TIME_ZONE = 'Asia/Taipei' # 改成台北時間
USE_I18N = False
USE_TZ = True

# --- Static files (CSS, JavaScript, Images) ---
STATIC_URL = 'static/'

# 告訴 Django 靜態檔案放在哪裡 (core/static)
STATICFILES_DIRS = [
    BASE_DIR / "core" / "static",
]

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Log in as guest: Session Expire
SESSION_EXPIRE_AT_BROWSER_CLOSE = True
SESSION_COOKIE_AGE = 604800 # 7 days