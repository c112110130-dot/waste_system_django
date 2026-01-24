"""
CSRF Utilities for secure API handling
Provides alternatives to @csrf_exempt decorator
"""
from functools import wraps
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.middleware.csrf import get_token
import json


def ajax_csrf_required(view_func):
    """
    Decorator that requires CSRF token for AJAX requests
    Provides better security than @csrf_exempt
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        # Check if this is an AJAX request
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            # For AJAX requests, ensure CSRF token is present
            csrf_token = request.headers.get('X-CSRFToken')
            if not csrf_token and request.method in ['POST', 'PUT', 'DELETE', 'PATCH']:
                return JsonResponse({
                    'success': False,
                    'error': 'CSRF token required for AJAX requests',
                    'csrf_token': get_token(request)
                }, status=403)
        
        return view_func(request, *args, **kwargs)
    return wrapper


def api_csrf_exempt(view_func):
    """
    Limited CSRF exemption for specific API endpoints
    Use sparingly and only for read-only operations or with additional authentication
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        # Log CSRF exempt usage for security auditing
        print(f"CSRF EXEMPT: {request.method} {request.path} from {request.META.get('REMOTE_ADDR')}")
        return csrf_exempt(view_func)(request, *args, **kwargs)
    return wrapper


def get_csrf_token_response(request):
    """
    Utility function to get CSRF token for client-side usage
    """
    return JsonResponse({
        'csrf_token': get_token(request)
    })