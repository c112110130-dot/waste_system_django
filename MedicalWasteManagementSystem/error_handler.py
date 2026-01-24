"""
Unified Error Handler for Medical Waste Management System

Provides secure error handling that prevents information leakage in production
while maintaining detailed debugging information in development.
"""
import logging
from django.conf import settings
from django.http import JsonResponse

logger = logging.getLogger(__name__)


def handle_error(exception, user_message="操作失敗，請稍後再試", log_context=None, status=500):
    """
    Unified error handler that provides secure error responses.

    Args:
        exception: The caught exception object
        user_message: User-friendly message to display (default: generic error)
        log_context: Additional context to include in logs (dict)
        status: HTTP status code (default: 500)

    Returns:
        JsonResponse with appropriate error details based on environment

    Behavior:
        - Production (DEBUG=False): Returns generic message, logs full error
        - Development (DEBUG=True): Returns full error details for debugging

    Example:
        try:
            # some operation
        except Exception as e:
            return handle_error(
                e,
                user_message="無法儲存資料",
                log_context={'user': request.user.username, 'action': 'save_data'},
                status=500
            )
    """
    # Build log message
    log_message = f"Error: {str(exception)}"
    if log_context:
        context_str = ', '.join(f"{k}={v}" for k, v in log_context.items())
        log_message = f"{log_message} | Context: {context_str}"

    # Log the full error (always logged regardless of DEBUG mode)
    logger.error(log_message, exc_info=True)

    # Prepare response based on environment
    if settings.DEBUG:
        # Development: Return detailed error for debugging
        response_data = {
            'success': False,
            'error': user_message,
            'debug_info': {
                'exception_type': type(exception).__name__,
                'exception_message': str(exception),
                'context': log_context
            }
        }
    else:
        # Production: Return only safe, generic message
        response_data = {
            'success': False,
            'error': user_message
        }

    return JsonResponse(response_data, status=status)


def handle_validation_error(errors, status=400):
    """
    Handle validation errors with consistent format.

    Args:
        errors: Dictionary of field errors or list of error messages
        status: HTTP status code (default: 400)

    Returns:
        JsonResponse with validation errors

    Example:
        if not form.is_valid():
            return handle_validation_error(form.errors)
    """
    if isinstance(errors, dict):
        # Django form errors format
        formatted_errors = {}
        for field, error_list in errors.items():
            formatted_errors[field] = [str(error) for error in error_list]

        return JsonResponse({
            'success': False,
            'error': '輸入資料驗證失敗',
            'errors': formatted_errors
        }, status=status)
    else:
        # Simple error list or string
        return JsonResponse({
            'success': False,
            'error': str(errors) if not isinstance(errors, list) else errors[0]
        }, status=status)


def log_security_event(event_type, details, user=None, ip=None, severity='WARNING'):
    """
    Log security-related events for monitoring.

    Args:
        event_type: Type of security event (e.g., 'PERMISSION_DENIED', 'SUSPICIOUS_ACTIVITY')
        details: Description of the event
        user: Username (if available)
        ip: IP address (if available)
        severity: Log level ('WARNING', 'ERROR', 'CRITICAL')

    Example:
        log_security_event(
            'PERMISSION_DENIED',
            'Attempt to access admin panel',
            user=request.user.username,
            ip=request.META.get('REMOTE_ADDR')
        )
    """
    log_func = getattr(logger, severity.lower(), logger.warning)

    message_parts = [f"SECURITY [{event_type}]: {details}"]
    if user:
        message_parts.append(f"User: {user}")
    if ip:
        message_parts.append(f"IP: {ip}")

    log_func(' | '.join(message_parts))