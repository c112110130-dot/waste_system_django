from django import template

register = template.Library()

#############################
# Permissions               #
#############################

@register.filter
def get_icon(dictionary, key):
    return dictionary.get(key, 'question')

@register.filter
def permission_name(value):
    """Translate permission group names to zh-Hant-TW"""
    translations = {
        'root': '根帳號',
        'moderator': '管理者',
        'staff': '行政人員',
        'registrar': '登錄者',
        'importer': '匯入者',
        'not-defined': '未知身份'
    }
    return translations.get(value, value.capitalize())

#############################
# Formatting                #
#############################

@register.filter
def strip_zeros(value):
    """
    Strips trailing zeros and the decimal point if the result is an integer.
    Handles both float and string inputs.
    """
    try:
        # Convert to float if it's not already
        num = float(value)
        # Convert to string and remove trailing zeros after decimal
        str_num = f"{num:f}".rstrip('0').rstrip('.')
        return str_num
    except (ValueError, TypeError):
        return value  # Return original value if conversion fails

#############################
# Theme                     #
#############################

# <!-- Basic usage -->
# <html class="{% theme_class %}">
# <body data-theme="{% current_theme %}">
#
# <!-- Conditional content -->
# {% is_theme "dark" as is_dark_mode %}
# {% if is_dark_mode %}
#     <div class="dark-only-content">Dark mode content</div>
# {% endif %}
#
# <!-- Theme-specific values -->
# <div style="color: {% current_theme|theme_conditional:'light:#000,dark:#fff,system:#333' %}">

@register.simple_tag(takes_context=True)
def current_theme(context):
    """Get current user's theme setting"""
    request = context['request']

    if request.user.is_authenticated and hasattr(request.user, 'profile'):
        return request.user.profile.theme_preference
    else:
        return 'system'


@register.simple_tag(takes_context=True)
def is_theme(context, theme_name):
    """Check if current theme matches given theme name"""
    request = context['request']

    if request.user.is_authenticated and hasattr(request.user, 'profile'):
        current = request.user.profile.theme_preference
    else:
        current = 'system'

    return current == theme_name


@register.simple_tag(takes_context=True)
def theme_class(context):
    """Get the appropriate CSS class for current theme"""
    request = context['request']

    if request.user.is_authenticated and hasattr(request.user, 'profile'):
        theme = request.user.profile.theme_preference
    else:
        theme = 'system'

    if theme == 'light':
        return 'is-light'
    elif theme == 'dark':
        return 'is-dark'
    else:  # system
        return 'is-light'  # Default fallback, JS handles actual detection


@register.simple_tag(takes_context=True)
def is_light_mode(context):
    """Check if theme should be light (for server-side rendering)"""
    request = context['request']

    if request.user.is_authenticated and hasattr(request.user, 'profile'):
        theme = request.user.profile.theme_preference
        return theme == 'light' or theme == 'system'  # Default to light for system
    else:
        return True  # Default to light for unauthenticated


@register.simple_tag(takes_context=True)
def is_dark_mode(context):
    """Check if theme should be dark (for server-side rendering)"""
    request = context['request']

    if request.user.is_authenticated and hasattr(request.user, 'profile'):
        theme = request.user.profile.theme_preference
        return theme == 'dark'
    else:
        return False


@register.simple_tag(takes_context=True)
def is_system_theme(context):
    """Check if theme is set to follow system"""
    request = context['request']

    if request.user.is_authenticated and hasattr(request.user, 'profile'):
        theme = request.user.profile.theme_preference
        return theme == 'system'
    else:
        return True  # Unauthenticated users default to system


@register.filter
def theme_conditional(value, theme_values):
    """
    Conditional filter for theme-specific values
    Usage: {{ some_value|theme_conditional:"light:value1,dark:value2,system:value3" }}
    """
    theme_map = {}
    for pair in theme_values.split(','):
        if ':' in pair:
            theme, val = pair.split(':', 1)
            theme_map[theme.strip()] = val.strip()

    return theme_map.get(value, value)