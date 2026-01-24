#!/bin/bash
# -----------------------------------------------------------------------------
# Stop Django server (Gunicorn) for MWMS project
# Linus-style: Graceful shutdown, clean up properly
# -----------------------------------------------------------------------------

PROJECT_DIR="$(pwd)"
PID_FILE="$PROJECT_DIR/gunicorn.pid"

# Try PID file first
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE" 2>/dev/null || echo "")

    if [ -n "$PID" ]; then
        echo "[INFO] Found PID file: $PID"

        if ps -p "$PID" > /dev/null 2>&1; then
            echo "[INFO] Stopping Gunicorn (PID: $PID)..."

            # Try graceful shutdown first (SIGTERM)
            kill -TERM "$PID" 2>/dev/null || true

            # Wait up to 10 seconds for graceful shutdown
            for i in {1..10}; do
                if ! ps -p "$PID" > /dev/null 2>&1; then
                    echo "[SUCCESS] Gunicorn stopped gracefully"
                    rm -f "$PID_FILE" 2>/dev/null || true
                    exit 0
                fi
                sleep 1
            done

            # Force kill if still running
            echo "[WARN] Graceful shutdown failed, forcing..."
            kill -KILL "$PID" 2>/dev/null || true
            rm -f "$PID_FILE" 2>/dev/null || true
            echo "[SUCCESS] Gunicorn stopped (forced)"
            exit 0
        else
            echo "[INFO] Process $PID not running (stale PID file)"
            rm -f "$PID_FILE" 2>/dev/null || true
        fi
    fi
fi

# Fallback: search by process name
PIDS=$(pgrep -f "MedicalWasteManagementSystem.wsgi:application" 2>/dev/null || echo "")

if [ -z "$PIDS" ]; then
    echo "[INFO] No Gunicorn process found"
    exit 0
fi

echo "[INFO] Found Gunicorn processes: $PIDS"
echo "[INFO] Stopping..."
echo "$PIDS" | xargs -r kill -TERM 2>/dev/null || true

# Wait a moment
sleep 2

# Clean up
rm -f "$PID_FILE" 2>/dev/null || true
echo "[SUCCESS] Gunicorn stopped"
