from django.contrib import admin
from .models import *


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


# Admin classes for each model
class GeneralWasteProductionAdmin(DisplayFieldsModelAdmin):
    def get_list_display(self, request):
        return ['date'] + [f'get_{field}' for field in GeneralWasteProduction.FIELD_INFO.keys()]

    search_fields = ('date',)
    list_filter = ('date',)
    ordering = ('-date',)

    def date(self, obj):
        return obj.date

    date.short_description = '日期'


class BiomedicalWasteProductionAdmin(DisplayFieldsModelAdmin):
    def get_list_display(self, request):
        return ['date'] + [f'get_{field}' for field in BiomedicalWasteProduction.FIELD_INFO.keys()]

    search_fields = ('date',)
    list_filter = ('date',)
    ordering = ('-date',)

    def date(self, obj):
        return obj.date

    date.short_description = '日期'


class DialysisBucketSoftBagProductionAndDisposalCostsAdmin(DisplayFieldsModelAdmin):
    def get_list_display(self, request):
        return ['date'] + [f'get_{field}' for field in
                           DialysisBucketSoftBagProductionAndDisposalCosts.FIELD_INFO.keys()]

    search_fields = ('date',)
    list_filter = ('date',)
    ordering = ('-date',)

    def date(self, obj):
        return obj.date

    date.short_description = '日期'


class PharmaceuticalGlassProductionAndDisposalCostsAdmin(DisplayFieldsModelAdmin):
    def get_list_display(self, request):
        return ['date'] + [f'get_{field}' for field in PharmaceuticalGlassProductionAndDisposalCosts.FIELD_INFO.keys()]

    search_fields = ('date',)
    list_filter = ('date',)
    ordering = ('-date',)

    def date(self, obj):
        return obj.date

    date.short_description = '日期'


class PaperIronAluminumCanPlasticAndGlassProductionAndRecyclingRevenueAdmin(DisplayFieldsModelAdmin):
    def get_list_display(self, request):
        return ['date'] + [f'get_{field}' for field in
                           PaperIronAluminumCanPlasticAndGlassProductionAndRecyclingRevenue.FIELD_INFO.keys()]

    search_fields = ('date',)
    list_filter = ('date',)
    ordering = ('-date',)

    def date(self, obj):
        return obj.date

    date.short_description = '日期'


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'display_order', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('name',)
    ordering = ('display_order', 'name')
    list_editable = ('display_order', 'is_active')

    fieldsets = (
        ('基本資訊', {
            'fields': ('name', 'display_order', 'is_active')
        }),
        ('系統資訊', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ('created_at',)


@admin.register(WasteType)
class WasteTypeAdmin(admin.ModelAdmin):
    list_display = ('name', 'unit', 'is_active', 'created_at')
    list_filter = ('unit', 'is_active', 'created_at')
    search_fields = ('name',)
    ordering = ('name',)
    list_editable = ('is_active',)

    fieldsets = (
        ('基本資訊', {
            'fields': ('name', 'unit', 'is_active')
        }),
        ('系統資訊', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ('created_at',)


@admin.register(WasteRecord)
class WasteRecordAdmin(admin.ModelAdmin):
    list_display = ('date', 'department', 'waste_type', 'amount', 'created_at')
    list_filter = ('waste_type', 'department', 'date', 'created_at')
    search_fields = ('department__name', 'waste_type__name', 'date')
    ordering = ('-date', 'department__display_order')
    raw_id_fields = ('department', 'waste_type')

    fieldsets = (
        ('基本資訊', {
            'fields': ('date', 'department', 'waste_type', 'amount')
        }),
        ('系統資訊', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ('created_at', 'updated_at')

    def get_queryset(self, request):
        """Optimize queryset with select_related"""
        return super().get_queryset(request).select_related('department', 'waste_type')


# Custom admin actions
@admin.action(description='啟用選中的部門')
def activate_departments(modeladmin, request, queryset):
    queryset.update(is_active=True)


@admin.action(description='停用選中的部門')
def deactivate_departments(modeladmin, request, queryset):
    queryset.update(is_active=False)


# Add custom actions to DepartmentAdmin
DepartmentAdmin.actions = [activate_departments, deactivate_departments]

# Register models
admin.site.register(GeneralWasteProduction, GeneralWasteProductionAdmin)
admin.site.register(BiomedicalWasteProduction, BiomedicalWasteProductionAdmin)
admin.site.register(DialysisBucketSoftBagProductionAndDisposalCosts,
                    DialysisBucketSoftBagProductionAndDisposalCostsAdmin)
admin.site.register(PharmaceuticalGlassProductionAndDisposalCosts, PharmaceuticalGlassProductionAndDisposalCostsAdmin)
admin.site.register(PaperIronAluminumCanPlasticAndGlassProductionAndRecyclingRevenue,
                    PaperIronAluminumCanPlasticAndGlassProductionAndRecyclingRevenueAdmin)