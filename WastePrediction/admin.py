from django.contrib import admin
from .models import HospitalOperationalData


class DisplayFieldsModelAdmin(admin.ModelAdmin):
    """Base admin class that displays field names using model's FIELD_INFO dictionary"""

    def __init__(self, model, admin_site):
        super().__init__(model, admin_site)
        # Get model's FIELD_INFO
        field_info = model.FIELD_INFO

        # Create getter methods for each field
        for field_name, info in field_info.items():
            method_name = f'get_{field_name}'

            def make_getter(field_name=field_name):
                def getter(obj):
                    return getattr(obj, field_name)

                # Set display name
                getter.short_description = field_info[field_name]['name']
                getter.admin_order_field = field_name
                return getter

            setattr(self, method_name, make_getter())


class HospitalOperationalDataAdmin(DisplayFieldsModelAdmin):
    def get_list_display(self, request):
        return ['date'] + [f'get_{field}' for field in HospitalOperationalData.FIELD_INFO.keys()]

    search_fields = ('date',)
    list_filter = ('date',)
    ordering = ('-date',)

    def date(self, obj):
        return obj.date

    date.short_description = '日期'


# Register model
admin.site.register(HospitalOperationalData, HospitalOperationalDataAdmin)