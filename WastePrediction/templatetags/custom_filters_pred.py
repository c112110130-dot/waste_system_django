from django import template
import json

register = template.Library()

@register.filter
def get_item(obj, key):
    if isinstance(obj, dict):
        return obj.get(key)
    elif isinstance(obj, list):
        return next((item for item in obj if item.get('row') == key or item.get('col') == key), None)
    return None

@register.filter
def json_dumps(value):
    return json.dumps(value)