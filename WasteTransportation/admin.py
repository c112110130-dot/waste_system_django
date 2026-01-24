from django.contrib import admin
from .models import (
    Enterprise,
    Transporter,
    TreatmentFacility,
    Recycler,
    Process,
    WasteSubstance,
    TransportVehicle,
    TreatmentVehicle,
    RecoveryVehicle,
    Declaration,
    Transportation,
    Treatment,
    Recovery,
    WasteSubstanceId,
    Manifest
)


@admin.register(Enterprise)
class EnterpriseAdmin(admin.ModelAdmin):
    list_display = ('enterprise_code', 'enterprise_name')
    search_fields = ('enterprise_code', 'enterprise_name')
    ordering = ('enterprise_code',)


@admin.register(Transporter)
class TransporterAdmin(admin.ModelAdmin):
    list_display = ('transporter_code', 'transporter_name', 'other_transporters')
    search_fields = ('transporter_code', 'transporter_name')
    ordering = ('transporter_code',)


@admin.register(TreatmentFacility)
class TreatmentFacilityAdmin(admin.ModelAdmin):
    list_display = ('treatment_facility_code', 'treatment_facility_name')
    search_fields = ('treatment_facility_code', 'treatment_facility_name')
    ordering = ('treatment_facility_code',)


@admin.register(Recycler)
class RecyclerAdmin(admin.ModelAdmin):
    list_display = ('recycler_code', 'recycler_name', 'recycling_purpose', 'recycler_type')
    search_fields = ('recycler_code', 'recycler_name')
    list_filter = ('recycler_type', 'recycling_purpose')
    ordering = ('recycler_code',)


@admin.register(Process)
class ProcessAdmin(admin.ModelAdmin):
    list_display = ('process_code', 'process_name')
    search_fields = ('process_code', 'process_name')
    ordering = ('process_code',)


@admin.register(WasteSubstance)
class WasteSubstanceAdmin(admin.ModelAdmin):
    list_display = ('waste_substance_code', 'waste_substance_name')
    search_fields = ('waste_substance_code', 'waste_substance_name')
    ordering = ('waste_substance_code',)


@admin.register(TransportVehicle)
class TransportVehicleAdmin(admin.ModelAdmin):
    list_display = ('transport_vehicle_number', 'transporter')
    search_fields = ('transport_vehicle_number', 'transporter__transporter_name')
    list_filter = ('transporter',)
    ordering = ('transport_vehicle_number',)


@admin.register(TreatmentVehicle)
class TreatmentVehicleAdmin(admin.ModelAdmin):
    list_display = ('treatment_vehicle_number', 'treatment_facility')
    search_fields = ('treatment_vehicle_number', 'treatment_facility__treatment_facility_name')
    list_filter = ('treatment_facility',)
    ordering = ('treatment_vehicle_number',)


@admin.register(RecoveryVehicle)
class RecoveryVehicleAdmin(admin.ModelAdmin):
    list_display = ('recovery_vehicle_number', 'recycler')
    search_fields = ('recovery_vehicle_number', 'recycler__recycler_name')
    list_filter = ('recycler',)
    ordering = ('recovery_vehicle_number',)


@admin.register(Declaration)
class DeclarationAdmin(admin.ModelAdmin):
    list_display = ('declaration_code', 'enterprise', 'declaration_datetime', 'declared_weight')
    search_fields = ('declaration_code', 'enterprise__enterprise_name')
    list_filter = ('declaration_datetime', 'enterprise')
    date_hierarchy = 'declaration_datetime'
    ordering = ('-declaration_datetime',)


@admin.register(Transportation)
class TransportationAdmin(admin.ModelAdmin):
    list_display = ('transportation_code', 'transporter', 'transportation_datetime', 'delivery_datetime')
    search_fields = ('transportation_code', 'transporter__transporter_name')
    list_filter = ('transportation_datetime', 'transporter')
    date_hierarchy = 'transportation_datetime'
    ordering = ('-transportation_datetime',)


@admin.register(Treatment)
class TreatmentAdmin(admin.ModelAdmin):
    list_display = ('treatment_code', 'treatment_facility', 'receipt_datetime', 'intermediate_treatment_method',
                    'final_disposal_method', 'treatment_completion_datetime')
    search_fields = ('treatment_code', 'treatment_facility__treatment_facility_name')
    list_filter = ('receipt_datetime', 'treatment_facility', 'intermediate_treatment_method', 'final_disposal_method',
                   'treatment_completion_datetime')
    date_hierarchy = 'receipt_datetime'
    ordering = ('-receipt_datetime',)


@admin.register(Recovery)
class RecoveryAdmin(admin.ModelAdmin):
    list_display = ('recovery_code', 'recycler', 'recovery_datetime')
    search_fields = ('recovery_code', 'recycler__recycler_name')
    list_filter = ('recovery_datetime', 'recycler')
    date_hierarchy = 'recovery_datetime'
    ordering = ('-recovery_datetime',)


@admin.register(WasteSubstanceId)
class WasteSubstanceIdAdmin(admin.ModelAdmin):
    list_display = ('waste_substance_id', 'process', 'waste_substance_code')
    search_fields = ('waste_substance_id', 'process__process_name', 'waste_substance_code__waste_substance_name')
    list_filter = ('process', 'waste_substance_code')
    ordering = ('waste_substance_id',)


@admin.register(Manifest)
class ManifestAdmin(admin.ModelAdmin):
    list_display = ('manifest_number', 'waste_substance_id', 'manifest_type_display', 'vehicle_number', 'is_visible',
                    'get_enterprise_name')
    search_fields = ('manifest_number', 'vehicle_number', 'declaration__enterprise__enterprise_name')
    list_filter = ('is_visible', 'treatment', 'recovery', 'declaration__enterprise')
    ordering = ('-declaration__declaration_datetime',)

    def get_enterprise_name(self, obj):
        return obj.declaration.enterprise.enterprise_name

    get_enterprise_name.short_description = '事業機構名稱'
    get_enterprise_name.admin_order_field = 'declaration__enterprise__enterprise_name'

    def manifest_type_display(self, obj):
        return obj.manifest_type_display

    manifest_type_display.short_description = '聯單類型'

    # Add actions to toggle visibility
    actions = ['make_visible', 'make_hidden']

    def make_visible(self, request, queryset):
        updated = queryset.update(is_visible=True)
        self.message_user(request, f'已將 {updated} 筆聯單設為可見')

    make_visible.short_description = '設為可見'

    def make_hidden(self, request, queryset):
        updated = queryset.update(is_visible=False)
        self.message_user(request, f'已將 {updated} 筆聯單設為隱藏')

    make_hidden.short_description = '設為隱藏'