from django.shortcuts import redirect
from django.urls import reverse
from django.http import JsonResponse

# Permission level definitions
GROUP_HIERARCHY = {
    "root": 40,
    "moderator": 30,
    "staff": 20,
    "registrar": 10,
    "importer": 10,
}

def get_permission_hi(user, id=False):
    """Return the highest permission level or group name for a user."""
    user_groups = user.groups.all() if user.is_authenticated else []
    if not user_groups:
        return 0 if id else "not-defined"

    highest_level = max(
        (GROUP_HIERARCHY.get(group.name, 0) for group in user_groups),
        default=0
    )
    if id:
        return highest_level

    # Return the first group name with the highest level (sorted alphabetically for consistency)
    matching_groups = [name for name, level in GROUP_HIERARCHY.items()
                       if level == highest_level and any(g.name == name for g in user_groups)]
    return sorted(matching_groups)[0] if matching_groups else "not-defined"

def get_permission_lo(user, id=False):
    """Return the lowest permission level or group name for a user."""
    user_groups = user.groups.all() if user.is_authenticated else []
    if not user_groups:
        return 0 if id else "not-defined"

    lowest_level = min(
        (GROUP_HIERARCHY.get(group.name, 0) for group in user_groups),
        default=0
    )
    if id:
        return lowest_level

    # Return the first group name with the lowest level (sorted alphabetically for consistency)
    matching_groups = [name for name, level in GROUP_HIERARCHY.items()
                       if level == lowest_level and any(g.name == name for g in user_groups)]
    return sorted(matching_groups)[0] if matching_groups else "not-defined"

def get_permission_all(user, id=False):
    """Return all permissions as a list of levels or group names."""
    user_groups = user.groups.all() if user.is_authenticated else []
    if not user_groups:
        return [] if id else ["not-defined"]
    if id:
        return [GROUP_HIERARCHY.get(group.name, 0) for group in user_groups]
    return [group.name for group in user_groups]

# Permission decorator
def permission_required(min_group, exact_group=None):
    def decorator(view_func):
        def _wrapped_view(request, *args, **kwargs):
            # Helper function to check if request is AJAX/API
            def is_ajax_request(request):
                return (
                    request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
                    request.content_type == 'application/json' or
                    request.headers.get('Accept', '').startswith('application/json') or
                    '/api/' in request.path
                )

            # Unauthenticated users
            if not request.user.is_authenticated:
                if is_ajax_request(request):
                    return JsonResponse({'success': False, 'error': '身份驗證失敗，請重新登入'}, status=401)
                else:
                    message = "Not login yet, please log in."
                    response = redirect(reverse('account:login'))
                    response['X-Message'] = message
                    return response

            # Get user's highest permission level
            user_level = get_permission_hi(request.user, id=True)

            # Check if user meets minimum permission requirement
            if user_level < GROUP_HIERARCHY[min_group]:
                if is_ajax_request(request):
                    return JsonResponse({'success': False, 'error': '權限不足，無法執行此操作'}, status=403)
                else:
                    message = "Unauthorized: Insufficient group membership."
                    response = redirect(reverse('main'))
                    response['X-Message'] = message
                    return response

            # If exact_group is specified, check for specific group membership
            if exact_group and exact_group not in get_permission_all(request.user):
                if is_ajax_request(request):
                    return JsonResponse({'success': False, 'error': f'此操作需要 {exact_group} 權限'}, status=403)
                else:
                    message = f"Unauthorized: This view requires '{exact_group}' group."
                    response = redirect(reverse('main'))
                    response['X-Message'] = message
                    return response

            return view_func(request, *args, **kwargs)

        # Attach permission query functions to decorator
        _wrapped_view.permission_hi = lambda user, id=False: get_permission_hi(user, id)
        _wrapped_view.permission_lo = lambda user, id=False: get_permission_lo(user, id)
        _wrapped_view.permission_all = lambda user, id=False: get_permission_all(user, id)

        return _wrapped_view
    return decorator

# Context processor (already configured in settings.py)
def user_group_define(request):
    # Get user groups based on authentication status
    user = request.user
    user_groups = user.groups.all() if user.is_authenticated else []

    # Define permission query functions for context (encapsulated to avoid passing user each time)
    def permission_hi(id=False):
        return get_permission_hi(user, id)

    def permission_lo(id=False):
        return get_permission_lo(user, id)

    def permission_all(id=False):
        return get_permission_all(user, id)

    # User identity flags
    is_root = user.groups.filter(name='root').exists() if user.is_authenticated else False
    is_moderator = user.groups.filter(name='moderator').exists() if user.is_authenticated else False
    is_staff = user.groups.filter(name='staff').exists() if user.is_authenticated else False
    is_registrar = user.groups.filter(name='registrar').exists() if user.is_authenticated else False
    is_importer = user.groups.filter(name='importer').exists() if user.is_authenticated else False

    is_over_mod = is_root or is_moderator
    is_over_staff = is_root or is_moderator or is_staff
    is_over_reg = is_root or is_moderator or is_staff or is_registrar
    is_over_imp = is_root or is_moderator or is_staff or is_importer

    # Return context data
    return {
        'user_is_root': is_root,
        'user_is_moderator': is_moderator,
        'user_is_staff': is_staff,
        'user_is_registrar': is_registrar,
        'user_is_importer': is_importer,

        'user_is_over_mod': is_over_mod,
        'user_is_over_staff': is_over_staff,
        'user_is_over_reg': is_over_reg,
        'user_is_over_imp': is_over_imp,

        'permission_hi': permission_hi,
        'permission_lo': permission_lo,
        'permission_all': permission_all,
    }

def has_override_permission(user, module_name):
    """
    Check if user has permission to override data in a module.

    Args:
        user: Django User object
        module_name: 'management', 'prediction', or 'transportation'

    Returns:
        bool: True if user has override permission

    Permission Rules:
        - management: registrar or higher (staff, moderator, root)
        - prediction: registrar or higher (staff, moderator, root)
        - transportation: importer or higher (staff, moderator, root)
    """
    if not user.is_authenticated:
        return False

    user_level = get_permission_hi(user, id=True)

    # Module minimum requirements
    if module_name in ['management', 'prediction']:
        return user_level >= GROUP_HIERARCHY['registrar']
    elif module_name == 'transportation':
        return user_level >= GROUP_HIERARCHY['importer']

    return False


# Usage examples:
#
# Decorator:
# @permission_required("moderator", exact_group="moderator")
# def some_view(request):
#     highest_level = some_view.permission_hi(request.user, id=True)
#     return HttpResponse(f"Highest permission: {highest_level}")
#
# Template:
# {% if permission_hi %}
#     <p>Highest Permission: {{ permission_hi.id }}</p>
#     <p>Highest Group: {{ permission_hi }}</p>
# {% endif %}
#
# Override permission check:
# from MedicalWasteManagementSystem.permissions import has_override_permission
# if not has_override_permission(request.user, 'management'):
#     return JsonResponse({'success': False, 'error': 'No permission to override data'})