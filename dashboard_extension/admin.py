from django.contrib import admin
from .models import  WasteRecord, Department, LocationPoint,clearAgency, processAgency, TransportRecord, WasteType
# Register your models here.

admin.site.register(WasteRecord)
admin.site.register(Department)
admin.site.register(LocationPoint)
admin.site.register(WasteType)
admin.site.register(clearAgency)
admin.site.register(processAgency)
admin.site.register(TransportRecord)
