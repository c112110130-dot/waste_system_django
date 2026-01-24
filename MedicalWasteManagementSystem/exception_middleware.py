"""
Unified Exception Handling Middleware
Provides comprehensive error handling, logging, and API response standardization
"""
import json
import logging
import traceback
from django.http import JsonResponse, Http404
from django.core.exceptions import ValidationError, PermissionDenied
from django.db import IntegrityError, OperationalError
from django.conf import settings
from django.utils.deprecation import MiddlewareMixin
from django.views.defaults import server_error, bad_request, permission_denied, page_not_found

logger = logging.getLogger(__name__)


class UnifiedException(Exception):
    """Base exception class for unified error handling"""
    def __init__(self, message, error_code=None, status_code=400, details=None):
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class APIException(UnifiedException):
    """Exception for API-specific errors"""
    pass


class ValidationException(UnifiedException):
    """Exception for validation errors"""
    def __init__(self, message, field_errors=None, **kwargs):
        super().__init__(message, **kwargs)
        self.field_errors = field_errors or {}


class BusinessLogicException(UnifiedException):
    """Exception for business logic violations"""
    pass


class UnifiedExceptionHandlingMiddleware(MiddlewareMixin):
    """
    Unified exception handling middleware that:
    1. Catches and standardizes all exceptions
    2. Provides consistent API error responses
    3. Logs errors appropriately
    4. Handles different types of requests (API vs HTML)
    """

    def __init__(self, get_response=None):
        super().__init__(get_response)
        self.get_response = get_response

    def is_api_request(self, request):
        """Determine if request is for API endpoint"""
        return (
            request.path.startswith('/api/') or
            request.path.endswith('/api/') or
            '/api/' in request.path or
            request.content_type == 'application/json' or
            request.headers.get('Accept', '').startswith('application/json') or
            request.headers.get('X-Requested-With') == 'XMLHttpRequest'
        )

    def get_error_context(self, request, exception):
        """Extract error context for logging"""
        return {
            'user': getattr(request.user, 'username', 'anonymous') if hasattr(request, 'user') else 'unknown',
            'path': request.path,
            'method': request.method,
            'ip': self.get_client_ip(request),
            'user_agent': request.headers.get('User-Agent', ''),
            'exception_type': type(exception).__name__,
            'exception_message': str(exception)
        }

    def get_client_ip(self, request):
        """Get client IP address"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0]
        return request.META.get('REMOTE_ADDR', 'unknown')

    def create_api_error_response(self, exception, request, status_code=500):
        """Create standardized API error response"""
        error_data = {
            'success': False,
            'error': str(exception),
            'timestamp': None  # Will be set by response formatter if available
        }

        # Add specific error details based on exception type
        if isinstance(exception, ValidationException):
            error_data['validation_errors'] = exception.field_errors
            error_data['error_code'] = exception.error_code or 'VALIDATION_ERROR'
            status_code = exception.status_code

        elif isinstance(exception, BusinessLogicException):
            error_data['error_code'] = exception.error_code or 'BUSINESS_LOGIC_ERROR'
            error_data['details'] = exception.details
            status_code = exception.status_code

        elif isinstance(exception, APIException):
            error_data['error_code'] = exception.error_code or 'API_ERROR'
            error_data['details'] = exception.details
            status_code = exception.status_code

        elif isinstance(exception, PermissionDenied):
            error_data['error'] = 'Access denied'
            error_data['error_code'] = 'PERMISSION_DENIED'
            status_code = 403

        elif isinstance(exception, ValidationError):
            error_data['error'] = 'Validation failed'
            error_data['error_code'] = 'VALIDATION_ERROR'
            error_data['validation_errors'] = exception.message_dict if hasattr(exception, 'message_dict') else {}
            status_code = 400

        elif isinstance(exception, IntegrityError):
            error_data['error'] = 'Data integrity constraint violation'
            error_data['error_code'] = 'INTEGRITY_ERROR'
            status_code = 409

        elif isinstance(exception, OperationalError):
            error_data['error'] = 'Database operation failed'
            error_data['error_code'] = 'DATABASE_ERROR'
            status_code = 503

        elif isinstance(exception, Http404):
            error_data['error'] = 'Resource not found'
            error_data['error_code'] = 'NOT_FOUND'
            status_code = 404

        # Add debug information in development
        if settings.DEBUG:
            error_data['debug'] = {
                'exception_type': type(exception).__name__,
                'traceback': traceback.format_exc()
            }

        return JsonResponse(error_data, status=status_code)

    def log_exception(self, request, exception, context):
        """Log exception with appropriate level"""
        log_message = f"Exception in {context['path']}: {context['exception_message']}"
        
        if isinstance(exception, (ValidationError, ValidationException, Http404)):
            # These are expected errors - log as warning
            logger.warning(log_message, extra=context)
        elif isinstance(exception, (PermissionDenied, APIException)):
            # Security/API related - log as error
            logger.error(log_message, extra=context)
        else:
            # Unexpected errors - log as critical with full traceback
            logger.critical(
                f"{log_message}\n{traceback.format_exc()}", 
                extra=context,
                exc_info=True
            )

    def process_exception(self, request, exception):
        """Process exceptions and return appropriate responses"""
        
        # Get error context for logging
        context = self.get_error_context(request, exception)
        
        # Log the exception
        self.log_exception(request, exception, context)

        # For API requests, always return JSON
        if self.is_api_request(request):
            return self.create_api_error_response(exception, request)

        # For non-API requests, let Django handle standard exceptions
        if isinstance(exception, Http404):
            return None  # Let Django's 404 handler take over
        elif isinstance(exception, PermissionDenied):
            return None  # Let Django's 403 handler take over
        
        # For other exceptions in non-API requests, return JSON if it's an AJAX request
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return self.create_api_error_response(exception, request)
        
        # Otherwise, let Django handle it normally
        return None

    def process_response(self, request, response):
        """Process responses to add additional headers or logging"""
        
        # Add security headers for API responses
        if self.is_api_request(request) and hasattr(response, 'status_code'):
            response['X-Content-Type-Options'] = 'nosniff'
            response['X-Frame-Options'] = 'DENY'
            response['X-XSS-Protection'] = '1; mode=block'
            
            # Add rate limiting headers (placeholder for future implementation)
            # response['X-RateLimit-Remaining'] = '100'
            # response['X-RateLimit-Reset'] = '3600'

        return response


# Convenience functions for raising standardized exceptions
def raise_validation_error(message, field_errors=None, error_code=None):
    """Raise a standardized validation error"""
    raise ValidationException(
        message=message,
        field_errors=field_errors,
        error_code=error_code,
        status_code=400
    )


def raise_business_logic_error(message, error_code=None, details=None):
    """Raise a standardized business logic error"""
    raise BusinessLogicException(
        message=message,
        error_code=error_code,
        status_code=400,
        details=details
    )


def raise_api_error(message, error_code=None, status_code=400, details=None):
    """Raise a standardized API error"""
    raise APIException(
        message=message,
        error_code=error_code,
        status_code=status_code,
        details=details
    )


# Error handler decorators
def handle_exceptions(error_message="An error occurred"):
    """Decorator to automatically handle exceptions in views"""
    def decorator(view_func):
        def wrapper(request, *args, **kwargs):
            try:
                return view_func(request, *args, **kwargs)
            except UnifiedException:
                # Re-raise unified exceptions to be handled by middleware
                raise
            except Exception as e:
                # Convert unexpected exceptions to unified exceptions
                logger.error(f"Unexpected error in {view_func.__name__}: {str(e)}")
                raise APIException(
                    message=error_message,
                    error_code="UNEXPECTED_ERROR",
                    status_code=500,
                    details={"original_error": str(e)}
                )
        return wrapper
    return decorator