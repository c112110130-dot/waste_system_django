"""
Audit Middleware
Intercepts HTTP requests and logs operations
"""
import json
from django.utils.deprecation import MiddlewareMixin
from .audit_logger import get_audit_logger


class AuditMiddleware(MiddlewareMixin):
    """Audit middleware - intercepts all HTTP requests"""

    # Skip these paths (static resources and polling endpoints)
    SKIP_PATHS = [
        '/static/',
        '/media/',
        '/api/time/',
        '/api/get_theme/',
        '/admin/jsi18n/',  # Django admin i18n
        '/favicon.ico',
    ]

    # Sensitive fields to filter
    SENSITIVE_FIELDS = [
        'password', 'passwd', 'pwd', 'secret', 'token', 'api_key',
        'private_key', 'access_token', 'refresh_token', 'session_id'
    ]

    def __init__(self, get_response=None):
        super().__init__(get_response)
        self.get_response = get_response
        self.audit = get_audit_logger()

    def __call__(self, request):
        # Skip static resources and polling endpoints
        if any(request.path.startswith(p) for p in self.SKIP_PATHS):
            return self.get_response(request)

        # Execute request
        response = self.get_response(request)

        # Log operation
        try:
            action = self._extract_action(request)
            resource = self._extract_resource(request)
            request_data = self._extract_request_data(request)

            self.audit.log(
                user=self._get_user(request),
                action=action,
                resource=resource,
                result='SUCCESS' if 200 <= response.status_code < 400 else 'FAILED',
                ip=self._get_ip(request),
                method=request.method,
                path=request.path,
                details=f"status={response.status_code}, data={request_data}"
            )
        except Exception as e:
            # Don't let logging errors break the request
            print(f"[Audit] Logging error: {e}")

        return response

    def _get_user(self, request):
        """Get username from request"""
        if hasattr(request, 'user') and request.user.is_authenticated:
            return request.user.username
        return 'anonymous'

    def _get_ip(self, request):
        """Get client IP address"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', 'unknown')

    def _extract_request_data(self, request):
        """Extract and sanitize request data"""
        try:
            # GET parameters
            if request.method == 'GET' and request.GET:
                data = dict(request.GET.items())
            # JSON body
            elif request.content_type == 'application/json' and request.body:
                data = json.loads(request.body)
            # POST data
            elif request.POST:
                data = dict(request.POST.items())
            else:
                return '{}'

            # Filter sensitive fields
            sanitized = self._sanitize_data(data)

            # Limit output length
            data_str = json.dumps(sanitized, ensure_ascii=False)
            if len(data_str) > 500:
                data_str = data_str[:500] + '...'

            return data_str
        except:
            return '{}'

    def _sanitize_data(self, data):
        """Remove sensitive fields from data"""
        if not isinstance(data, dict):
            return data

        sanitized = {}
        for key, value in data.items():
            key_lower = key.lower()

            # Filter sensitive fields
            if any(sensitive in key_lower for sensitive in self.SENSITIVE_FIELDS):
                sanitized[key] = '***FILTERED***'
            elif isinstance(value, dict):
                sanitized[key] = self._sanitize_data(value)
            elif isinstance(value, list) and len(value) > 0 and isinstance(value[0], dict):
                sanitized[key] = [self._sanitize_data(item) for item in value[:3]]  # Limit to first 3 items
                if len(value) > 3:
                    sanitized[key].append(f'...and {len(value) - 3} more items')
            else:
                sanitized[key] = value

        return sanitized

    def _extract_action(self, request):
        """Extract action from request path and method"""
        path = request.path.lower()
        method = request.method

        # GET requests to pages = PAGE_VIEW
        if method == 'GET' and not path.startswith('/api/'):
            return 'PAGE_VIEW'

        # Path-based specific actions (priority)
        if 'login' in path:
            return 'LOGIN'
        elif 'logout' in path:
            return 'LOGOUT'
        elif 'register' in path:
            return 'REGISTER'
        elif 'change_password' in path or 'set_password' in path:
            return 'CHANGE_PASSWORD'
        elif 'delete' in path or 'remove' in path:
            return 'DELETE'
        elif 'batch_import' in path:
            return 'BATCH_IMPORT'
        elif 'import' in path:
            return 'IMPORT'
        elif 'export' in path:
            return 'EXPORT'
        elif 'save' in path or 'update' in path:
            return 'SAVE'
        elif 'get' in path or 'calculate' in path or 'visualize' in path:
            return 'QUERY'
        elif 'toggle' in path or 'set_theme' in path:
            return 'UPDATE_SETTING'

        # Method-based default mapping
        action_map = {
            'POST': 'CREATE',
            'PUT': 'UPDATE',
            'PATCH': 'UPDATE',
            'DELETE': 'DELETE',
            'GET': 'QUERY'
        }

        return action_map.get(method, 'OPERATION')

    def _extract_resource(self, request):
        """Extract resource from request path"""
        path = request.path

        # Root - Main menu
        if path == '/' or path == '/main/':
            return '[Main] Dashboard'

        # Module: Management
        if '/management/' in path:
            # Page views
            if path == '/management/database/':
                return '[Management] Waste Data Management Page'
            elif path == '/management/visualize/':
                return '[Management] Visualization Page'
            elif path == '/management/visualize_dept/':
                return '[Management] Department Visualization Page'
            elif path == '/management/department/':
                return '[Management] Department Data Management Page'

            # API operations - Department
            if '/department/' in path:
                if '/save/' in path:
                    return '[Management] Department Waste Record'
                elif '/delete/' in path:
                    return '[Management] Department Waste Record'
                elif '/batch_import/' in path:
                    return '[Management] Department Waste Records (Batch)'
                elif '/export/' in path:
                    return '[Management] Department Data Export'
                elif '/data/' in path:
                    return '[Management] Department Waste Data'
                elif '/month_status/' in path:
                    return '[Management] Department Month Status'
                return '[Management] Department'

            # API operations - Visualization
            elif '/visualize' in path:
                if '/config/' in path:
                    return '[Management] Visualization Config'
                elif '/data/' in path:
                    return '[Management] Visualization Data'
                return '[Management] Visualization'

            # API operations - Waste data
            elif '/save_data/' in path:
                return '[Management] Waste Record'
            elif '/delete_data/' in path:
                return '[Management] Waste Record'
            elif '/batch_import/' in path:
                return '[Management] Waste Records (Batch)'
            elif '/get_data/' in path:
                return '[Management] Waste Data Query'

            return '[Management] Waste Data'

        # Module: Prediction
        elif '/prediction/' in path:
            # Page view
            if path == '/prediction/':
                return '[Prediction] Prediction Analysis Page'

            # API operations
            if '/batch_import/' in path:
                return '[Prediction] Hospital Operational Data (Batch)'
            elif '/save_data/' in path:
                return '[Prediction] Hospital Operational Data'
            elif '/delete_data/' in path:
                return '[Prediction] Hospital Operational Data'
            elif '/get_data/' in path:
                return '[Prediction] Data Query'
            elif '/calculate_prediction/' in path:
                return '[Prediction] Waste Prediction Calculation'
            elif '/calculate_correlation/' in path:
                return '[Prediction] Correlation Analysis'

            return '[Prediction] Data'

        # Module: Transportation
        elif '/transportation/' in path:
            # Page view
            if path == '/transportation/':
                return '[Transportation] Transportation Management Page'

            # API operations
            if '/get_manifests/' in path:
                return '[Transportation] Manifest Query'
            elif '/get_manifest_detail/' in path:
                return '[Transportation] Manifest Detail'
            elif '/get_statistics/' in path:
                return '[Transportation] Statistics'
            elif '/get_field_options/' in path:
                return '[Transportation] Field Options'
            elif '/get_filtered_field_options/' in path:
                return '[Transportation] Filtered Field Options'
            elif '/toggle_visibility/' in path:
                return '[Transportation] Manifest Visibility'
            elif '/batch_import/' in path or '/import_manifests/' in path:
                return '[Transportation] Manifest Import'
            elif '/bulk_remove/' in path:
                return '[Transportation] Manifest Bulk Removal'
            elif '/get_existing_manifest_data/' in path:
                return '[Transportation] Existing Manifest Data'
            elif '/get_matching_count/' in path:
                return '[Transportation] Matching Count'
            elif '/get_matching_manifests/' in path:
                return '[Transportation] Matching Manifests'

            return '[Transportation] Manifest'

        # Module: Account
        elif '/account/' in path:
            # Page views
            if path == '/account/login/':
                return '[Account] Login Page'
            elif path == '/account/register/':
                return '[Account] Registration Page'
            elif path == '/account/setting/':
                return '[Account] Settings Page'
            elif path.startswith('/account/manage/'):
                if path == '/account/manage/':
                    return '[Account] User Management Page'
                else:
                    return '[Account] User Details Page'
            elif path == '/account/database/':
                return '[Account] Database Config Page'

            # API operations
            if '/login/' in path and request.method == 'POST':
                return '[Account] Login'
            elif '/logout/' in path:
                return '[Account] Logout'
            elif '/logout_guest/' in path:
                return '[Account] Guest Logout'
            elif '/register/' in path and request.method == 'POST':
                return '[Account] User Registration'
            elif '/change_password/' in path:
                return '[Account] Password Change'
            elif '/delete/' in path:
                return '[Account] User Account Deletion'
            elif '/database/' in path:
                if '/waste-type/save/' in path:
                    return '[Account] Waste Type Save'
                elif '/waste-type/delete/' in path:
                    return '[Account] Waste Type Delete'
                elif '/department/save/' in path:
                    return '[Account] Department Save'
                elif '/department/delete/' in path:
                    return '[Account] Department Delete'
                elif '/data/' in path:
                    return '[Account] Database Config Query'
                return '[Account] Database Config'
            elif '/set_theme/' in path:
                return '[Account] Theme Setting'

            return '[Account] Account'

        # Django Admin
        elif '/admin/' in path:
            return '[Admin] Django Admin'

        # Global API
        elif '/api/' in path:
            if '/extended-chart-data/' in path:
                return '[API] Extended Chart Data'
            return '[API] Unknown'

        return '[System] Unknown'