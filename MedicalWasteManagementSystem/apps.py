"""
MedicalWasteManagementSystem AppConfig
"""
from django.apps import AppConfig
from pathlib import Path
import os


class MedicalWasteManagementSystemConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'MedicalWasteManagementSystem'

    # Flag to ensure rotation only happens once
    _rotation_done = False

    def ready(self):
        """Execute on Django startup"""
        # Django calls ready() multiple times in runserver
        # Only rotate on first call and not during migrations
        if not self._rotation_done and not self._is_migration_run():
            print("[Audit] App ready, attempting log rotation...")
            self._rotate_audit_log()
            MedicalWasteManagementSystemConfig._rotation_done = True

    def _is_migration_run(self):
        """Check if this is a migration run"""
        import sys
        return 'migrate' in sys.argv or 'makemigrations' in sys.argv

    def _rotate_audit_log(self):
        """Rotate all logs (Django + Gunicorn) on startup"""
        try:
            from django.conf import settings
            from .audit_logger import LogRotator

            log_dir = settings.BASE_DIR / 'logs'
            project_root = settings.BASE_DIR

            rotator = LogRotator(log_dir, project_root=project_root)
            rotator.rotate_on_startup()
        except Exception as e:
            print(f"[Audit] Failed to rotate log on startup: {e}")
            import traceback
            traceback.print_exc()