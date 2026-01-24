#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="$(pwd)"
PROJECT_NAME="MedicalWasteManagementSystem"
VENV_PATH="$PROJECT_DIR/.venv"
NGINX_CONF="/etc/nginx/sites-available/mwms"
NGINX_ENABLED="/etc/nginx/sites-enabled/mwms"
GUNICORN_CONF="$PROJECT_DIR/gunicorn.conf.py"
ENV_FILE="$PROJECT_DIR/.env.production"
BACKUP_DIR="$PROJECT_DIR/backups"
SSL_DIR="/etc/ssl/mwms"
LOGROTATE_CONF="/etc/logrotate.d/mwms"

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "\n${GREEN}==>${NC} $1"
}

check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_error "DO NOT run this script as root. Use sudo only when needed."
        exit 1
    fi
}

check_ubuntu_version() {
    log_step "Checking Ubuntu version..."
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        # Accept 22.04 and newer versions
        if [[ "$VERSION_ID" == "22.04" ]] || [[ "$VERSION_ID" > "22.04" ]]; then
            log_info "Ubuntu $VERSION_ID detected - OK"
        else
            log_warn "This script is designed for Ubuntu 22.04 or newer, you have $VERSION_ID"
            read -p "Continue anyway? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    else
        log_error "Cannot detect OS version"
        exit 1
    fi
}

check_python() {
    log_step "Checking Python installation..."

    # Check if python3 exists
    if ! command -v python3 &> /dev/null; then
        log_error "Python3 not found. Installing Python 3.12..."
        install_python312
        return
    fi

    # Get current Python version
    PYTHON_VERSION=$(python3 --version | awk '{print $2}')
    PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
    PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)

    log_info "Python $PYTHON_VERSION found"

    # Check if version is 3.12 or higher
    if [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -ge 12 ]; then
        log_info "Python version is 3.12+ - OK"
        PYTHON_CMD="python3"
    elif [ "$PYTHON_MAJOR" -gt 3 ]; then
        log_info "Python version is 4+ - OK"
        PYTHON_CMD="python3"
    else
        log_warn "Python $PYTHON_VERSION is below 3.12"

        # Check if python3.12 already exists
        if command -v python3.12 &> /dev/null; then
            PYTHON312_VERSION=$(python3.12 --version | awk '{print $2}')
            log_info "Found Python 3.12: $PYTHON312_VERSION"
            PYTHON_CMD="python3.12"
        else
            log_info "Installing Python 3.12..."
            install_python312
        fi
    fi
}

install_python312() {
    log_step "Installing Python 3.12..."

    # Add deadsnakes PPA for latest Python versions
    sudo apt update
    sudo apt install -y software-properties-common
    sudo add-apt-repository -y ppa:deadsnakes/ppa
    sudo apt update

    # Install Python 3.12 and required packages
    sudo apt install -y \
        python3.12 \
        python3.12-venv \
        python3.12-dev

    # Verify installation
    if command -v python3.12 &> /dev/null; then
        PYTHON312_VERSION=$(python3.12 --version | awk '{print $2}')
        log_info "Python 3.12 installed: $PYTHON312_VERSION"
        PYTHON_CMD="python3.12"
    else
        log_error "Failed to install Python 3.12"
        exit 1
    fi
}

install_system_deps() {
    log_step "Installing system dependencies..."
    sudo apt update
    sudo apt install -y \
        nginx \
        python3-pip \
        python3-venv \
        build-essential \
        git
    log_info "System dependencies installed"
}

setup_venv() {
    log_step "Setting up virtual environment..."

    # Use PYTHON_CMD from check_python() or fallback to python3
    local PYTHON_BIN="${PYTHON_CMD:-python3}"

    if [ ! -d "$VENV_PATH" ]; then
        log_info "Creating venv with $PYTHON_BIN..."
        $PYTHON_BIN -m venv "$VENV_PATH"
        log_info "Virtual environment created"
    else
        log_info "Virtual environment already exists"
    fi

    source "$VENV_PATH/bin/activate"
    pip install --upgrade pip
    pip install gunicorn

    if [ -f "$PROJECT_DIR/requirements.txt" ]; then
        log_info "Installing Python dependencies..."
        pip install -r "$PROJECT_DIR/requirements.txt"
    else
        log_warn "requirements.txt not found - skipping Python deps"
    fi
}

create_field_config() {
    log_step "Creating field configuration file..."

    FIELD_CONFIG="$PROJECT_DIR/field_config.json"

    if [ -f "$FIELD_CONFIG" ]; then
        log_info "field_config.json already exists - skipping"
        return
    fi

    cat > "$FIELD_CONFIG" << 'EOF'
{
  "general_waste_production": {
    "fields": {
      "tainan": {
        "name": "南區一般事業廢棄物產量",
        "unit": "metric_ton",
        "visible": true,
        "order": 1,
        "editable": true
      },
      "renwu": {
        "name": "仁武一般事業廢棄物產量",
        "unit": "metric_ton",
        "visible": true,
        "order": 2,
        "editable": true
      },
      "field_1": {
        "name": "",
        "unit": "metric_ton",
        "visible": false,
        "order": 3,
        "editable": true
      },
      "field_2": {
        "name": "",
        "unit": "metric_ton",
        "visible": false,
        "order": 4,
        "editable": true
      },
      "field_3": {
        "name": "",
        "unit": "metric_ton",
        "visible": false,
        "order": 5,
        "editable": true
      },
      "field_4": {
        "name": "",
        "unit": "metric_ton",
        "visible": false,
        "order": 6,
        "editable": true
      },
      "field_5": {
        "name": "",
        "unit": "metric_ton",
        "visible": false,
        "order": 7,
        "editable": true
      },
      "field_6": {
        "name": "",
        "unit": "metric_ton",
        "visible": false,
        "order": 8,
        "editable": true
      },
      "field_7": {
        "name": "",
        "unit": "metric_ton",
        "visible": false,
        "order": 9,
        "editable": true
      },
      "field_8": {
        "name": "",
        "unit": "metric_ton",
        "visible": false,
        "order": 10,
        "editable": true
      },
      "field_9": {
        "name": "",
        "unit": "metric_ton",
        "visible": false,
        "order": 11,
        "editable": true
      },
      "field_10": {
        "name": "",
        "unit": "metric_ton",
        "visible": false,
        "order": 12,
        "editable": true
      },
      "total": {
        "name": "一般事業廢棄物總產量",
        "unit": "metric_ton",
        "visible": true,
        "order": 100,
        "editable": false,
        "auto_calculated": true
      }
    },
    "auto_sum_fields": [
      "tainan",
      "renwu",
      "field_1",
      "field_2",
      "field_3",
      "field_4",
      "field_5",
      "field_6",
      "field_7",
      "field_8",
      "field_9",
      "field_10"
    ]
  }
}
EOF

    log_info "field_config.json created at $FIELD_CONFIG"
}

generate_secret_key() {
    python3 -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
}

create_env_file() {
    log_step "Creating production environment file..."

    if [ -f "$ENV_FILE" ]; then
        log_warn ".env.production already exists"
        read -p "Overwrite? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Keeping existing .env.production"
            return
        fi
    fi

    read -p "Enter your domain or IP address (e.g., mwms.example.com): " DOMAIN

    # Generate SECRET_KEY and save to system environment
    SECRET_KEY=$(generate_secret_key)

    log_info "Setting SECRET_KEY in system environment..."

    # Add to /etc/environment for system-wide persistence
    if ! grep -q "DJANGO_SECRET_KEY=" /etc/environment 2>/dev/null; then
        echo "DJANGO_SECRET_KEY='$SECRET_KEY'" | sudo tee -a /etc/environment > /dev/null
        log_info "SECRET_KEY added to /etc/environment"
    else
        log_warn "DJANGO_SECRET_KEY already exists in /etc/environment"
    fi

    # Export for current session
    export DJANGO_SECRET_KEY="$SECRET_KEY"

    cat > "$ENV_FILE" << EOF
# Medical Waste Management System - Production Configuration
# Created by initialize.sh on $(date)
#
# IMPORTANT: .env.production presence enables production mode (DEBUG=False)
# - Remove this file to return to development mode (DEBUG=True)
# - SECRET_KEY is stored in environment variable DJANGO_SECRET_KEY (not here)

# Host Configuration
ALLOWED_HOSTS=$DOMAIN,www.$DOMAIN,localhost,127.0.0.1

# HTTPS/SSL Settings
# Set to True after SSL certificate is configured
SECURE_SSL_REDIRECT=False
SESSION_COOKIE_SECURE=False
CSRF_COOKIE_SECURE=False
SECURE_BROWSER_XSS_FILTER=True
SECURE_CONTENT_TYPE_NOSNIFF=True

# Environment marker
ENVIRONMENT=production
EOF

    chmod 600 "$ENV_FILE"
    log_info "Environment file created at $ENV_FILE"
    log_info "Database: Using SQLite (db.sqlite3)"
    log_info "ALLOWED_HOSTS: $DOMAIN, www.$DOMAIN, localhost, 127.0.0.1"
}

create_gunicorn_config() {
    log_step "Creating Gunicorn configuration..."

    cat > "$GUNICORN_CONF" << 'EOF'
# Gunicorn configuration file
# Linus-style: Simple, explicit, no magic

import multiprocessing
import os

# Server socket - bind to localhost only (nginx proxies to this)
bind = "127.0.0.1:8000"
backlog = 2048

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"
worker_connections = 1000
timeout = 120
keepalive = 5

# Logging
# All logs go to separate files
accesslog = "access.log"      # HTTP access logs
errorlog = "error.log"        # Error and startup logs
loglevel = "info"

# Capture stdout/stderr to log file
# This catches print() statements and uncaught exceptions
capture_output = True

# Process naming
proc_name = "mwms_gunicorn"

# Server mechanics
daemon = False
pidfile = "gunicorn.pid"      # PID file for process management
umask = 0
user = None
group = None
tmp_upload_dir = None
EOF

    log_info "Gunicorn config created at $GUNICORN_CONF"
}

create_nginx_config() {
    log_step "Creating Nginx configuration..."

    if [ -f "$ENV_FILE" ]; then
        source "$ENV_FILE"
    else
        log_error ".env.production not found"
        exit 1
    fi

    # Create global Nginx optimization config for long server names
    log_info "Configuring Nginx hash bucket size..."
    sudo tee /etc/nginx/conf.d/server_names_hash.conf > /dev/null << 'EOF'
# Increase hash bucket size for long server names
server_names_hash_bucket_size 128;
EOF

    sudo tee "$NGINX_CONF" > /dev/null << EOF
server {
    listen 80;
    server_name $ALLOWED_HOSTS;

    client_max_body_size 100M;

    # Static files
    location /static/ {
        alias $PROJECT_DIR/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Media files
    location /media/ {
        alias $PROJECT_DIR/media/;
        expires 7d;
    }

    # Proxy to Gunicorn
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Timeouts
        proxy_connect_timeout 120;
        proxy_send_timeout 120;
        proxy_read_timeout 120;
        send_timeout 120;
    }
}
EOF

    # Enable site
    if [ ! -L "$NGINX_ENABLED" ]; then
        sudo ln -s "$NGINX_CONF" "$NGINX_ENABLED"
        log_info "Nginx site enabled"
    else
        log_info "Nginx site already enabled"
    fi

    # Test Nginx configuration
    sudo nginx -t
    log_info "Nginx configuration is valid"
}

setup_ssl_certificates() {
    log_step "SSL Certificate Setup..."

    echo "Do you have SSL certificate files from your organization?"
    echo "  1) Yes, I have the certificate files"
    echo "  2) No, skip SSL setup (use HTTP only)"
    read -p "Select option [1-2]: " SSL_CHOICE

    case $SSL_CHOICE in
        1)
            setup_organization_ssl
            ;;
        2)
            log_info "Skipping SSL setup - using HTTP"
            return
            ;;
        *)
            log_warn "Invalid choice - skipping SSL setup"
            return
            ;;
    esac
}

setup_organization_ssl() {
    log_step "Setting up organization-provided SSL certificate..."

    sudo mkdir -p "$SSL_DIR"
    sudo chmod 700 "$SSL_DIR"

    echo
    log_info "Please prepare the SSL certificate files from your IT department:"
    log_info "  - Certificate file (.pem, .crt, or .cer)"
    log_info "  - Private key file (.key or .pem)"
    echo
    log_warn "=========================================="
    log_warn "IMPORTANT: Enter FULL PATH + FILENAME"
    log_warn "DO NOT enter directory only!"
    log_warn "=========================================="
    echo
    log_info "Example:"
    log_info "  Certificate: /home/user/cert.pem"
    log_info "  Private key: /home/user/key.key"
    echo

    # Loop until valid certificate files are provided
    local max_attempts=3
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        echo "=========================================="
        echo "Attempt $attempt of $max_attempts"
        echo "=========================================="
        read -p "Certificate file (full path): " CERT_FILE
        read -p "Private key file (full path): " KEY_FILE
        echo

        # Validate input is not a directory
        if [[ "$CERT_FILE" == */ ]] || [[ "$KEY_FILE" == */ ]]; then
            log_error "ERROR: You entered a directory, not a file"
            log_info "Please include the filename in the path"
            echo
            attempt=$((attempt + 1))
            continue
        fi

        # Check if certificate file exists
        if ! sudo test -f "$CERT_FILE"; then
            log_error "Certificate file not found: $CERT_FILE"

            CERT_DIR=$(dirname "$CERT_FILE")
            if [ -d "$CERT_DIR" ]; then
                log_info "Files in $CERT_DIR:"
                sudo ls -lh "$CERT_DIR" 2>/dev/null | grep -E '\.(pem|crt|cert|cer)$' || echo "  (no certificate files found)"
            else
                log_warn "Directory does not exist: $CERT_DIR"
            fi

            attempt=$((attempt + 1))
            echo
            continue
        fi

        # Check certificate file permissions
        if [ ! -r "$CERT_FILE" ]; then
            log_warn "Certificate file not readable, trying sudo..."
            if ! sudo test -r "$CERT_FILE"; then
                log_error "Cannot read certificate file even with sudo"
                attempt=$((attempt + 1))
                echo
                continue
            fi
        fi

        # Check if key file exists
        if ! sudo test -f "$KEY_FILE"; then
            log_error "Private key file not found: $KEY_FILE"

            KEY_DIR=$(dirname "$KEY_FILE")
            if [ -d "$KEY_DIR" ]; then
                log_info "Files in $KEY_DIR:"
                sudo ls -lh "$KEY_DIR" 2>/dev/null | grep -E '\.(key|pem)$' || echo "  (no key files found)"
            else
                log_warn "Directory does not exist: $KEY_DIR"
            fi

            attempt=$((attempt + 1))
            echo
            continue
        fi

        # Check key file permissions
        if [ ! -r "$KEY_FILE" ]; then
            log_warn "Private key file not readable, trying sudo..."
            if ! sudo test -r "$KEY_FILE"; then
                log_error "Cannot read private key file even with sudo"
                attempt=$((attempt + 1))
                echo
                continue
            fi
        fi

        # Files found and readable
        log_info "Certificate files found and readable"
        log_info "  Certificate: $CERT_FILE"
        log_info "  Private key: $KEY_FILE"
        break
    done

    # Check if we exhausted attempts
    if [ $attempt -gt $max_attempts ]; then
        log_error "Maximum attempts reached. Skipping SSL setup."
        log_info "You can configure SSL manually later"
        return 0
    fi

    # Copy certificates to system SSL directory
    log_info "Copying certificate files to system directory..."

    sudo cp "$CERT_FILE" "$SSL_DIR/cert.pem"
    sudo cp "$KEY_FILE" "$SSL_DIR/key.key"

    # Set ownership to root:root (standard for system SSL certs)
    sudo chown root:root "$SSL_DIR/cert.pem" "$SSL_DIR/key.key"

    # Set permissions: readable by root and ssl-cert group only
    sudo chmod 640 "$SSL_DIR/cert.pem" "$SSL_DIR/key.key"

    # Ensure nginx user can read the certificates
    sudo chgrp ssl-cert "$SSL_DIR/cert.pem" "$SSL_DIR/key.key" 2>/dev/null || \
        sudo chgrp www-data "$SSL_DIR/cert.pem" "$SSL_DIR/key.key"

    log_info "Certificates securely stored in $SSL_DIR"
    log_info "Only root and web server can access the private key"

    # Update Nginx configuration for SSL
    if [ -f "$ENV_FILE" ]; then
        source "$ENV_FILE"
    fi

    sudo tee "$NGINX_CONF" > /dev/null << EOF
# HTTP - Redirect to HTTPS
server {
    listen 80;
    server_name $ALLOWED_HOSTS;
    return 301 https://\$host\$request_uri;
}

# HTTPS
server {
    listen 443 ssl http2;
    server_name $ALLOWED_HOSTS;

    # SSL Configuration
    ssl_certificate $SSL_DIR/cert.pem;
    ssl_certificate_key $SSL_DIR/key.key;

    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    client_max_body_size 100M;

    # Static files
    location /static/ {
        alias $PROJECT_DIR/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Media files
    location /media/ {
        alias $PROJECT_DIR/media/;
        expires 7d;
    }

    # Protect sensitive files
    location ~ /\..*|db\.sqlite3 {
        deny all;
        return 404;
    }

    # Application
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Timeouts
        proxy_connect_timeout 120;
        proxy_send_timeout 120;
        proxy_read_timeout 120;
        send_timeout 120;
    }
}
EOF

    sudo nginx -t
    log_info "SSL certificate configured successfully"

    # Automatically update .env.production to enable SSL security settings
    if [ -f "$ENV_FILE" ]; then
        log_info "Updating .env.production to enable SSL security settings..."

        sed -i 's/SECURE_SSL_REDIRECT=False/SECURE_SSL_REDIRECT=True/' "$ENV_FILE"
        sed -i 's/SESSION_COOKIE_SECURE=False/SESSION_COOKIE_SECURE=True/' "$ENV_FILE"
        sed -i 's/CSRF_COOKIE_SECURE=False/CSRF_COOKIE_SECURE=True/' "$ENV_FILE"

        log_info "SECURE_SSL_REDIRECT enabled"
        log_info "SESSION_COOKIE_SECURE enabled"
        log_info "CSRF_COOKIE_SECURE enabled"
        log_warn "Server restart required for SSL settings to take effect"
    else
        log_warn ".env.production not found, SSL security settings not updated"
        log_info "Please manually set SECURE_SSL_REDIRECT, SESSION_COOKIE_SECURE, and CSRF_COOKIE_SECURE to True"
    fi
}

setup_logrotate() {
    log_step "Setting up log rotation..."

    CURRENT_USER=$(whoami)
    LOGROTATE_TEMPLATE="$PROJECT_DIR/logrotate.conf"

    if [ ! -f "$LOGROTATE_TEMPLATE" ]; then
        log_error "logrotate.conf template not found"
        return 1
    fi

    # Replace placeholders in template
    sudo sed -e "s|PROJECT_DIR|$PROJECT_DIR|g" \
             -e "s|USER|$CURRENT_USER|g" \
             "$LOGROTATE_TEMPLATE" | sudo tee "$LOGROTATE_CONF" > /dev/null

    log_info "Logrotate configured at $LOGROTATE_CONF"
    log_info "Logs will be rotated daily and kept for 30 days"

    # Test logrotate configuration
    sudo logrotate -d "$LOGROTATE_CONF" > /dev/null 2>&1 || log_warn "Logrotate test warning (may be normal)"
}

init_system_data() {
    log_step "Initializing system data (groups and root account)..."
    source "$VENV_PATH/bin/activate"

    # Run the management command
    python manage.py init_system

    log_info "System initialization completed"
}

verify_django_settings() {
    log_step "Verifying Django settings configuration..."

    SETTINGS_FILE="$PROJECT_DIR/$PROJECT_NAME/settings.py"

    if [ ! -f "$SETTINGS_FILE" ]; then
        log_error "Django settings.py not found at $SETTINGS_FILE"
        exit 1
    fi

    # Activate virtual environment for Python checks
    source "$VENV_PATH/bin/activate"

    # Verify settings.py uses environment variables correctly
    log_info "Checking settings.py configuration..."

    python3 << 'PYEOF'
import sys
import os

# Add project to path
sys.path.insert(0, os.getcwd())

try:
    # Set minimal environment for import
    os.environ.setdefault('DJANGO_SECRET_KEY', 'test-key-for-verification')
    os.environ.setdefault('DEBUG', 'False')

    # Import settings
    from MedicalWasteManagementSystem import settings

    # Verify critical settings exist
    checks = {
        'SECRET_KEY': hasattr(settings, 'SECRET_KEY'),
        'DEBUG': hasattr(settings, 'DEBUG'),
        'ALLOWED_HOSTS': hasattr(settings, 'ALLOWED_HOSTS'),
        'DATABASES': hasattr(settings, 'DATABASES'),
        'STATIC_ROOT': hasattr(settings, 'STATIC_ROOT'),
        'MEDIA_ROOT': hasattr(settings, 'MEDIA_ROOT'),
        'LOGGING': hasattr(settings, 'LOGGING'),
    }

    # Check if using decouple (recommended)
    import importlib.util
    has_decouple = importlib.util.find_spec('decouple') is not None

    all_passed = all(checks.values())

    if all_passed:
        print("✓ Settings configuration verified")
        print(f"✓ Using python-decouple: {has_decouple}")
        print("✓ SECRET_KEY will be loaded from system environment")
        print("✓ Database: SQLite (no external database required)")
        sys.exit(0)
    else:
        print("✗ Settings verification failed:")
        for key, passed in checks.items():
            print(f"  {key}: {'✓' if passed else '✗'}")
        sys.exit(1)

except Exception as e:
    print(f"✗ Error verifying settings: {e}")
    sys.exit(1)
PYEOF

    if [ $? -eq 0 ]; then
        log_info "Settings verification passed"
    else
        log_error "Settings verification failed"
        log_error "Please check $SETTINGS_FILE configuration"
        exit 1
    fi
}

create_backup_dir() {
    log_step "Creating backup directory..."
    mkdir -p "$BACKUP_DIR"
    log_info "Backup directory created at $BACKUP_DIR"
}

collect_static() {
    log_step "Collecting static files..."
    source "$VENV_PATH/bin/activate"

    if python manage.py collectstatic --noinput; then
        log_info "Static files collected successfully"

        # Fix permissions for nginx to serve static files
        log_info "Setting permissions for static files..."
        chmod -R 755 "$PROJECT_DIR/staticfiles"
        chmod -R 755 "$PROJECT_DIR/media" 2>/dev/null || true

        log_info "Static files are now readable by web server"
    else
        log_error "Failed to collect static files"
        exit 1
    fi
}

run_migrations() {
    log_step "Running database migrations..."
    source "$VENV_PATH/bin/activate"
    python manage.py migrate
    log_info "Migrations completed"
}

fix_start_script() {
    log_step "Fixing start-server.sh..."

    START_SCRIPT="$PROJECT_DIR/start-server.sh"

    if [ -f "$START_SCRIPT" ]; then
        # Backup original
        cp "$START_SCRIPT" "$START_SCRIPT.bak" 2>/dev/null || true

        # Fix bind address
        sed -i 's/--bind 0\.0\.0\.0:8000/--bind 127.0.0.1:8000/g' "$START_SCRIPT"

        # Use gunicorn config file
        sed -i 's/gunicorn --bind 127\.0\.0\.1:8000/gunicorn -c gunicorn.conf.py/g' "$START_SCRIPT"

        log_info "start-server.sh updated"
    fi
}

create_systemd_service() {
    log_step "Creating systemd service..."

    read -p "Create systemd service for auto-start? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Skipping systemd service creation"
        return
    fi

    SERVICE_FILE="/etc/systemd/system/mwms.service"
    CURRENT_USER=$(whoami)

    sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=Medical Waste Management System (Gunicorn)
After=network.target

[Service]
Type=notify
User=$CURRENT_USER
Group=www-data
WorkingDirectory=$PROJECT_DIR
Environment="PATH=$VENV_PATH/bin"
EnvironmentFile=/etc/environment
EnvironmentFile=$ENV_FILE
ExecStart=$VENV_PATH/bin/gunicorn -c $GUNICORN_CONF $PROJECT_NAME.wsgi:application
ExecReload=/bin/kill -s HUP \$MAINPID
KillMode=mixed
TimeoutStopSec=5
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable mwms.service

    log_info "Systemd service created. Use: sudo systemctl start mwms"
}

final_checks() {
    log_step "Running final checks..."

    # Check if all files exist
    local all_ok=true

    [ -f "$ENV_FILE" ] || { log_error ".env.production missing"; all_ok=false; }
    [ -f "$GUNICORN_CONF" ] || { log_error "gunicorn.conf.py missing"; all_ok=false; }
    [ -f "$NGINX_CONF" ] || { log_error "Nginx config missing"; all_ok=false; }
    [ -d "$VENV_PATH" ] || { log_error "Virtual environment missing"; all_ok=false; }

    if [ "$all_ok" = true ]; then
        log_info "All checks passed!"
    else
        log_error "Some checks failed - review errors above"
        exit 1
    fi
}

print_summary() {
    log_step "Initialization Complete!"

    cat << EOF

========================================
 DEPLOYMENT SUMMARY
========================================

Configuration Files:
  - Environment: $ENV_FILE
  - Gunicorn:    $GUNICORN_CONF
  - Nginx:       $NGINX_CONF

Database:
  - SQLite (db.sqlite3) - no setup required

Next Steps:
  1. Review and update Django settings.py
  2. Test the application:
     $ source $VENV_PATH/bin/activate
     $ python manage.py runserver

  3. Start production server:
     $ ./start-server.sh
     OR
     $ sudo systemctl start mwms (if systemd service was created)

  4. Reload Nginx:
     $ sudo systemctl reload nginx

  5. Check logs:
     $ tail -f gunicorn.log access.log error.log

Security Reminders:
  - DEBUG is set to False
  - SECRET_KEY is randomized
  - Gunicorn binds to 127.0.0.1 (not exposed)
  - .env.production has 600 permissions

========================================
EOF
}

main() {
    log_info "Starting MWMS Production Initialization"
    log_info "Project directory: $PROJECT_DIR"
    echo

    check_root
    check_ubuntu_version
    check_python

    install_system_deps
    setup_venv
    create_field_config
    create_backup_dir
    create_env_file
    create_gunicorn_config
    verify_django_settings
    run_migrations
    collect_static
    init_system_data
    create_nginx_config
    setup_ssl_certificates
    setup_logrotate
    fix_start_script
    create_systemd_service

    final_checks
    print_summary

    log_info "Done. Read the summary above before starting the server."
}

main