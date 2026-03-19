from django.contrib import admin
from .models import  WasteRecord, LocationPoint,clearAgency, processAgency, TransportRecord, WasteType
# Register your models here.

admin.site.register(WasteRecord)

admin.site.register(LocationPoint)


admin.site.register(clearAgency)
admin.site.register(processAgency)
admin.site.register(TransportRecord)
