"""
Shared Database Optimization Middleware
Consolidated from duplicate middleware files to reduce code duplication
"""
from django.db import connections, OperationalError
import logging
import time

logger = logging.getLogger(__name__)


def reset_db_connection():
    """Reset database connections to recover from lock errors and optimize performance."""
    # Close all current DB connections to release locks
    connections.close_all()

    # Get a fresh connection
    connection = connections['default']
    try:
        # Ensure connection is usable
        connection.ensure_connection()

        # Apply optimizations to the fresh connection for SQLite
        if 'sqlite3' in connection.settings_dict['ENGINE']:
            cursor = connection.cursor()

            # Set WAL journal mode for better concurrency
            cursor.execute('PRAGMA journal_mode=WAL;')

            # Reduce fsync frequency - NORMAL balances safety and speed
            cursor.execute('PRAGMA synchronous=NORMAL;')

            # Larger cache size for better performance (16MB)
            cursor.execute('PRAGMA cache_size=-16000;')

            # Increase busy timeout to wait longer for locks (15 seconds)
            cursor.execute('PRAGMA busy_timeout=15000;')

            # Use memory for temp storage
            cursor.execute('PRAGMA temp_store=MEMORY;')

            # Enable memory-mapped I/O for the DB if supported
            cursor.execute('PRAGMA mmap_size=268435456;')  # 256MB

            # Release cursor to close statement
            cursor.close()

            logger.info("Applied SQLite connection optimizations")

    except OperationalError as e:
        logger.error(f"Failed to reset connection: {e}")
        # Force close and try one more time
        connections.close_all()


# Initialize database connection with optimized settings
reset_db_connection()


class DatabaseOptimizationMiddleware:
    """Middleware to optimize database connections and handle lock errors."""

    def __init__(self, get_response):
        self.get_response = get_response
        # Apply optimizations on startup
        reset_db_connection()

    def __call__(self, request):
        try:
            # For batch import requests, apply optimizations before processing
            if request.path.endswith('/batch_import/'):
                reset_db_connection()

            response = self.get_response(request)
            return response

        except OperationalError as e:
            if "database is locked" in str(e):
                logger.warning("Database lock detected, resetting connections")
                reset_db_connection()
                # Re-raise so Django can handle the error appropriately
                raise
            else:
                raise