"""
Operation Audit Logger
"""
import gzip
import shutil
import logging
import tarfile
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo


class LogRotator:
    """Log rotation handler - archives all .log files together"""

    MAX_LOGS_PER_DAY = 16

    # Django application logs (in logs/ directory)
    DJANGO_LOG_FILES = ['latest.log', 'debug.log', 'error.log']

    # Gunicorn logs (in project root directory)
    GUNICORN_LOG_FILES = ['access.log', 'error.log']

    def __init__(self, log_dir, project_root=None):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(exist_ok=True)

        # Project root for Gunicorn logs (parent of logs/)
        self.project_root = Path(project_root) if project_root else self.log_dir.parent

        self.tz = ZoneInfo('Asia/Taipei')

    def rotate_on_startup(self):
        """Archive all .log files (Django + Gunicorn) into a single .tar.gz on startup"""
        # Collect all log files from both locations
        all_logs = []

        # Django logs (in logs/ directory)
        django_logs = [self.log_dir / name for name in self.DJANGO_LOG_FILES]
        all_logs.extend([(p, f'django/{p.name}') for p in django_logs if p.exists()])

        # Gunicorn logs (in project root)
        # Note: Gunicorn also has 'error.log', but it's different from Django's
        gunicorn_logs = [self.project_root / name for name in self.GUNICORN_LOG_FILES]
        all_logs.extend([(p, f'gunicorn/{p.name}') for p in gunicorn_logs if p.exists()])

        if not all_logs:
            print("[LogRotate] No log files found, skipping rotation")
            return

        today = datetime.now(self.tz).strftime('%Y-%m-%d')
        existing = list(self.log_dir.glob(f'{today}-*.tar.gz'))
        next_num = len(existing) + 1

        if next_num > self.MAX_LOGS_PER_DAY:
            self._roll_logs(today)
            next_num = self.MAX_LOGS_PER_DAY

        archive_name = self.log_dir / f'{today}-{next_num}.tar.gz'
        try:
            total_size = sum(p.stat().st_size for p, _ in all_logs)
            log_summary = {}
            for p, arcname in all_logs:
                category = arcname.split('/')[0]  # 'django' or 'gunicorn'
                if category not in log_summary:
                    log_summary[category] = []
                log_summary[category].append(p.name)

            print(f"[LogRotate] Archiving {len(all_logs)} logs ({total_size:,} bytes) to {archive_name.name}")
            for category, files in log_summary.items():
                print(f"[LogRotate]   {category}: {', '.join(files)}")

            # Create tar.gz with all log files in organized structure
            with tarfile.open(archive_name, 'w:gz', compresslevel=6) as tar:
                for log_path, arcname in all_logs:
                    tar.add(log_path, arcname=arcname)

            # Truncate all archived logs (keep files, clear content)
            for log_path, _ in all_logs:
                try:
                    log_path.write_text('')
                except Exception as e:
                    print(f"[LogRotate] Warning: Could not clear {log_path.name}: {e}")

            print(f"[LogRotate] Successfully archived to {archive_name.name}, cleared source logs")
        except Exception as e:
            print(f"[LogRotate] Failed to rotate logs: {e}")
            import traceback
            traceback.print_exc()

    def _roll_logs(self, date):
        """Roll and delete oldest log when limit reached"""
        oldest = self.log_dir / f'{date}-1.tar.gz'
        if oldest.exists():
            oldest.unlink()

        for i in range(2, self.MAX_LOGS_PER_DAY + 1):
            src = self.log_dir / f'{date}-{i}.tar.gz'
            dst = self.log_dir / f'{date}-{i-1}.tar.gz'
            if src.exists():
                src.rename(dst)


class AuditLogger:
    """Operation audit logger"""

    def __init__(self):
        self.logger = logging.getLogger('audit')

    def log(self, user, action, resource, result, ip, method, path, details=None):
        """Log an operation"""
        # Formatter will handle timestamp, just build the message
        msg = f"{user} | {ip} | {method} {path} | {action} {resource} | {result}"

        if details:
            msg += f" | {details}"

        self.logger.info(msg)

    def log_login(self, user, ip, success=True, details=None):
        """Log login operation"""
        self.log(
            user=user,
            action='LOGIN',
            resource='System',
            result='SUCCESS' if success else 'FAILED',
            ip=ip,
            method='POST',
            path='/account/login/',
            details=details
        )

    def log_logout(self, user, ip):
        """Log logout operation"""
        self.log(
            user=user,
            action='LOGOUT',
            resource='System',
            result='SUCCESS',
            ip=ip,
            method='POST',
            path='/account/logout/',
            details=None
        )

    def log_data_operation(self, user, ip, method, path, action, model_name, object_id, result, details=None):
        """Log data operations"""
        resource = f"{model_name} #{object_id}" if object_id else model_name
        self.log(
            user=user,
            action=action,
            resource=resource,
            result=result,
            ip=ip,
            method=method,
            path=path,
            details=details
        )


# Global instance
_audit_logger = None

def get_audit_logger():
    """Get global audit logger instance"""
    global _audit_logger
    if _audit_logger is None:
        _audit_logger = AuditLogger()
    return _audit_logger