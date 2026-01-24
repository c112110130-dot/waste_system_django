#!/bin/bash
# -----------------------------------------------------------------------------
# Start Django server (Gunicorn + Nginx) for MWMS project
# Linus-style: Simple, secure, predictable
# -----------------------------------------------------------------------------


PROJECT_DIR="$(pwd)"
VENV_PATH="$PROJECT_DIR/.venv"
WSGI_MODULE="MedicalWasteManagementSystem.wsgi:application"
GUNICORN_CONF="$PROJECT_DIR/gunicorn.conf.py"
PID_FILE="$PROJECT_DIR/gunicorn.pid"

echo "[INFO] Project directory: $PROJECT_DIR"

# Check if already running
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "[ERROR] Gunicorn is already running (PID: $PID)"
        echo "[INFO] Use ./stop-server.sh first"
        exit 1
    else
        # Stale PID file
        rm -f "$PID_FILE"
    fi
fi

# Check Nginx configuration
echo "[INFO] Checking Nginx configuration..."
if ! sudo nginx -t 2>/dev/null; then
    echo "[ERROR] Nginx configuration test failed"
    exit 1
fi

# Check if Nginx is running and start/reload accordingly
echo "[INFO] Checking Nginx status..."
if sudo systemctl is-active --quiet nginx; then
    echo "[INFO] Nginx is running - reloading..."
    sudo systemctl reload nginx || {
        echo "[WARN] Nginx reload failed, trying restart..."
        sudo systemctl restart nginx || {
            echo "[ERROR] Nginx restart failed"
            exit 1
        }
    }
else
    echo "[INFO] Nginx is not running - starting..."
    sudo systemctl start nginx || {
        echo "[ERROR] Failed to start Nginx"
        exit 1
    }
    sudo systemctl enable nginx 2>/dev/null || true
fi

# Load environment variables from /etc/environment
if [ -f /etc/environment ]; then
    set -a
    source /etc/environment
    set +a
fi

# Activate virtual environment
if [ -f "$VENV_PATH/bin/activate" ]; then
    echo "[INFO] Activating virtual environment..."
    source "$VENV_PATH/bin/activate"
else
    echo "[ERROR] Virtual environment not found at $VENV_PATH"
    exit 1
fi

# Check if gunicorn config exists
if [ ! -f "$GUNICORN_CONF" ]; then
    echo "[ERROR] Gunicorn config not found at $GUNICORN_CONF"
    exit 1
fi

# Start Gunicorn
echo "[INFO] Starting Gunicorn with config: $GUNICORN_CONF"
gunicorn -c "$GUNICORN_CONF" \
    --pid "$PID_FILE" \
    --daemon \
    "$WSGI_MODULE"

# Wait a moment and check if it started
sleep 1
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "[SUCCESS] Gunicorn started (PID: $PID)"
        echo "[INFO] Logs: gunicorn.log, access.log, error.log"
        echo "[INFO] Stop with: ./stop-server.sh"
    else
        echo "[ERROR] Gunicorn failed to start"
        exit 1
    fi
else
    echo "[ERROR] PID file not created"
    exit 1
fi
