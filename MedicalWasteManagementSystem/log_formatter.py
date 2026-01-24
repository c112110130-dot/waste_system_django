"""
Unified Log Formatter
Ensures consistent timestamp format across all log types
"""
import logging
from datetime import datetime
from zoneinfo import ZoneInfo


class UnifiedLogFormatter(logging.Formatter):
    """
    Unified log formatter with consistent timestamp
    Format: YYYY/MM/DD hh:mm:ss.SSS Z+0800
    """

    def __init__(self, log_type, fmt=None, datefmt=None, style='%', validate=True):
        """
        Args:
            log_type: Log type marker, e.g., 'AUDIT', 'DEBUG', 'ERROR', or 'LEVEL' to use actual log level
            fmt: Log message format (default uses log_type)
            datefmt: Not used - we handle timestamp ourselves
            style: Format style (default '%')
            validate: Whether to validate format string
        """
        self.log_type = log_type
        self.tz = ZoneInfo('Asia/Taipei')

        # Default format if not specified
        if fmt is None:
            if log_type == 'AUDIT':
                # AUDIT: timestamp | [AUDIT] | message (audit_logger provides full message)
                fmt = '%(timestamp)s | [%(log_type)s] | %(message)s'
            elif log_type == 'DEBUG':
                # DEBUG: timestamp | [DEBUG] | logger:line - message
                fmt = '%(timestamp)s | [%(log_type)s] | %(name)s:%(lineno)d - %(message)s'
            elif log_type == 'LEVEL':
                # LEVEL: Use actual log level - timestamp | [levelname] | logger:line - message
                fmt = '%(timestamp)s | [%(levelname)s] | %(name)s:%(lineno)d - %(message)s'
            else:  # ERROR, INFO, WARNING, etc. - fixed type
                # Others: timestamp | [TYPE] | logger:line - message
                fmt = '%(timestamp)s | [%(log_type)s] | %(name)s:%(lineno)d - %(message)s'

        super().__init__(fmt, datefmt, style, validate)

    def formatTime(self, record, datefmt=None):
        """
        Override formatTime to use custom format
        Format: YYYY/MM/DD hh:mm:ss.SSS Z+0800
        """
        # Get current time with timezone
        ct = datetime.fromtimestamp(record.created, tz=self.tz)

        # Format: YYYY/MM/DD hh:mm:ss.SSS
        timestamp = ct.strftime('%Y/%m/%d %H:%M:%S')

        # Add milliseconds
        timestamp += f'.{int(ct.microsecond / 1000):03d}'

        # Add timezone offset
        # ct.strftime('%z') returns '+0800', we want 'Z+0800'
        tz_offset = ct.strftime('%z')
        timestamp += f' Z{tz_offset}'

        return timestamp

    def format(self, record):
        """Override format to inject custom timestamp and log_type"""
        # Add custom timestamp
        record.timestamp = self.formatTime(record)

        # Add log type marker
        record.log_type = self.log_type

        # Call parent format
        return super().format(record)