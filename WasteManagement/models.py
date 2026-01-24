# 單位：
#     metric_ton: 公噸
#     kilogram: 公斤
#     new_taiwan_dollar: 新台幣(NTD/TWD)

from django.db import models
from django.contrib.auth.models import User

class GeneralWasteProduction(models.Model): # 一般事業廢棄物產出表
    date = models.CharField(max_length=7, primary_key=True) # YYYY-MM
    tainan = models.FloatField(null=True, blank=True)
    renwu = models.FloatField(null=True, blank=True)

    # Reserved dynamic fields for future expansion
    field_1 = models.FloatField(null=True, blank=True)
    field_2 = models.FloatField(null=True, blank=True)
    field_3 = models.FloatField(null=True, blank=True)
    field_4 = models.FloatField(null=True, blank=True)
    field_5 = models.FloatField(null=True, blank=True)
    field_6 = models.FloatField(null=True, blank=True)
    field_7 = models.FloatField(null=True, blank=True)
    field_8 = models.FloatField(null=True, blank=True)
    field_9 = models.FloatField(null=True, blank=True)
    field_10 = models.FloatField(null=True, blank=True)

    total = models.FloatField(null=True, blank=True, editable=False)

    class Meta:
        db_table = 'general_waste_production'
        verbose_name = "一般事業廢棄物產出表"
        verbose_name_plural = "一般事業廢棄物產出表"

    def save(self, *args, **kwargs):
        """Auto-calculate total from all visible fields"""
        # Sum all fields including dynamic fields
        all_fields = [
            self.tainan, self.renwu,
            self.field_1, self.field_2, self.field_3, self.field_4, self.field_5,
            self.field_6, self.field_7, self.field_8, self.field_9, self.field_10
        ]
        self.total = sum(f or 0 for f in all_fields)
        super().save(*args, **kwargs)

    @classmethod
    def get_field_config(cls):
        """Load field configuration from JSON file"""
        import json
        import os
        from django.conf import settings

        config_path = os.path.join(settings.BASE_DIR, 'field_config.json')
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
            return config.get('general_waste_production', {})
        except FileNotFoundError:
            # Fallback to default FIELD_INFO if config file not found
            return {}

    @classmethod
    def get_visible_fields(cls):
        """Get all visible fields from configuration"""
        config = cls.get_field_config()
        fields_config = config.get('fields', {})

        # Return fields sorted by order
        visible_fields = {
            field_name: field_info
            for field_name, field_info in fields_config.items()
            if field_info.get('visible', False)
        }

        # Sort by order
        return dict(sorted(visible_fields.items(), key=lambda x: x[1].get('order', 999)))

    # Legacy FIELD_INFO for backward compatibility (will be replaced by JSON config)
    FIELD_INFO = {
        'tainan': {'name': '南區一般事業廢棄物產量', 'unit': 'metric_ton'},
        'renwu': {'name': '仁武一般事業廢棄物產量', 'unit': 'metric_ton'},
        'total': {'name': '一般事業廢棄物總產量', 'unit': 'metric_ton'},
    }

class BiomedicalWasteProduction(models.Model): # 生物醫療廢棄物產出表
    date = models.CharField(max_length=7, primary_key=True) # YYYY-MM
    red_bag = models.FloatField(null=True, blank=True)
    yellow_bag = models.FloatField(null=True, blank=True)
    total = models.FloatField(null=True, blank=True, editable=False)

    class Meta:
        db_table = 'biomedical_waste_production'
        verbose_name = "生物醫療廢棄物產出表"
        verbose_name_plural = "生物醫療廢棄物產出表"

    def save(self, *args, **kwargs):
        """Auto-calculate total from red_bag and yellow_bag"""
        self.total = (self.red_bag or 0) + (self.yellow_bag or 0)
        super().save(*args, **kwargs)

    # 欄位名稱與單位定義
    FIELD_INFO = {
        'red_bag': {'name': '紅袋生物醫療廢棄物產量', 'unit': 'metric_ton', 'editable': True},
        'yellow_bag': {'name': '黃袋生物醫療廢棄物產量', 'unit': 'metric_ton', 'editable': True},
        'total': {'name': '生物醫療廢棄物總產量', 'unit': 'metric_ton', 'editable': False, 'auto_calculated': True},
    }

class DialysisBucketSoftBagProductionAndDisposalCosts(models.Model): # 洗腎桶軟袋產出及處理費用表
    date = models.CharField(max_length=7, primary_key=True) # YYYY-MM
    produced_dialysis_bucket = models.FloatField(null=True, blank=True)
    produced_soft_bag = models.FloatField(null=True, blank=True)
    cost = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'dialysis_bucket_soft_bag_production_and_disposal_costs'
        verbose_name = "洗腎桶軟袋產出及處理費用表"
        verbose_name_plural = "洗腎桶軟袋產出及處理費用表"

    # 欄位名稱與單位定義
    FIELD_INFO = {
        'produced_dialysis_bucket': {'name': '洗腎桶產出', 'unit': 'kilogram', 'editable': True},
        'produced_soft_bag': {'name': '軟袋產出', 'unit': 'kilogram', 'editable': True},
        'cost': {'name': '洗腎桶軟袋處理費用', 'unit': 'new_taiwan_dollar', 'editable': True},
    }

class PharmaceuticalGlassProductionAndDisposalCosts(models.Model): # 藥用玻璃產出及處理費用表
    date = models.CharField(max_length=7, primary_key=True) # YYYY-MM
    produced = models.FloatField(null=True, blank=True)
    cost = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'pharmaceutical_glass_production_and_disposal_costs'
        verbose_name = "藥用玻璃產出及處理費用表"
        verbose_name_plural = "藥用玻璃產出及處理費用表"

    # 欄位名稱與單位定義
    FIELD_INFO = {
        'produced': {'name': '藥用玻璃產量', 'unit': 'kilogram', 'editable': True},
        'cost': {'name': '藥用玻璃處理費用', 'unit': 'new_taiwan_dollar', 'editable': True},
    }

class PaperIronAluminumCanPlasticAndGlassProductionAndRecyclingRevenue(models.Model): # 紙鐵鋁罐塑膠玻璃產出及回收收入表
    date = models.CharField(max_length=7, primary_key=True) # YYYY-MM
    paper_produced = models.FloatField(null=True, blank=True)
    iron_aluminum_can_produced = models.FloatField(null=True, blank=True)
    plastic_produced = models.FloatField(null=True, blank=True)
    glass_produced = models.FloatField(null=True, blank=True)
    recycling_revenue = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'paper_iron_aluminum_can_plastic_and_glass_production_and_recycling_revenue'
        verbose_name = "紙鐵鋁罐塑膠玻璃產出及回收收入表"
        verbose_name_plural = "紙鐵鋁罐塑膠玻璃產出及回收收入表"

    # 欄位名稱與單位定義
    FIELD_INFO = {
        'paper_produced': {'name': '紙產量', 'unit': 'kilogram', 'editable': True},
        'iron_aluminum_can_produced': {'name': '鐵鋁罐產量', 'unit': 'kilogram', 'editable': True},
        'plastic_produced': {'name': '塑膠產量', 'unit': 'kilogram', 'editable': True},
        'glass_produced': {'name': '玻璃產量', 'unit': 'kilogram', 'editable': True},
        'recycling_revenue': {'name': '回收收入', 'unit': 'new_taiwan_dollar', 'editable': True},
    }

########################################################################################################################
#   DB - Department
########################################################################################################################


class Department(models.Model):
    """Department entity - Dynamic management of hospital departments"""
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255, unique=True)
    display_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'departments'
        ordering = ['display_order', 'name']
        verbose_name = "部門"
        verbose_name_plural = "部門"
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['is_active'])
        ]

    def __str__(self):
        return self.name


class WasteType(models.Model):
    """Waste type entity - Support multiple waste types"""
    UNIT_CHOICES = [
        ('metric_ton', '公噸'),
        ('kilogram', '公斤'),
    ]
    
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255, unique=True)
    unit = models.CharField(max_length=50, choices=UNIT_CHOICES, default='metric_ton')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'waste_types'
        verbose_name = "廢棄物種類"
        verbose_name_plural = "廢棄物種類"
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['is_active'])
        ]

    def __str__(self):
        return self.name
    
    def get_unit_display_name(self):
        """Get unit display name in Chinese"""
        return dict(self.UNIT_CHOICES).get(self.unit, self.unit)




class WasteRecord(models.Model):
    """Waste record entity - Core transaction table (depends on Department and WasteType)"""
    id = models.AutoField(primary_key=True)
    date = models.CharField(max_length=7)  # YYYY-MM format
    department = models.ForeignKey(Department, on_delete=models.CASCADE)
    waste_type = models.ForeignKey(WasteType, on_delete=models.CASCADE)
    amount = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_waste_records')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_waste_records')

    class Meta:
        db_table = 'waste_records'
        unique_together = ('date', 'department', 'waste_type')
        indexes = [
            models.Index(fields=['date']),
            models.Index(fields=['department', 'date']),
            models.Index(fields=['waste_type', 'date']),
            models.Index(fields=['created_by']),
            models.Index(fields=['updated_by'])
        ]
        verbose_name = "廢棄物紀錄"
        verbose_name_plural = "廢棄物紀錄"

    def __str__(self):
        return f"{self.date} - {self.department.name} - {self.waste_type.name}"
    


class DepartmentWasteConfiguration:
    """Dynamic configuration management system"""

    # Unit translation mapping
    UNIT_TRANSLATION = {
        'metric_ton': {'display': '公噸', 'symbol': 'T'},
        'kilogram': {'display': '公斤', 'symbol': 'kg'}
    }

    # Default department list
    DEFAULT_DEPARTMENTS = [
        'W102', '病理檢驗部(門診檢驗室)', 'W82', 'W103', 'W72', 'W71',
        '教學研究部', 'W91', 'W83', 'W81', 'W51', '新生兒加護', '燒燙傷',
        'GW07', 'EW01', 'EW02', 'GW03', 'GW05', '產後護理', 'W31', 'W36',
        'W73', 'W75', 'W66', '洗腎室', 'W62', 'W35', 'W63', 'W92', 'W52',
        '小兒加護', 'W37', 'W32', 'W65', 'W85', 'RICU', 'W55', '產房',
        'W105', 'RCC呼吸加護病房', 'W53',
        '手術室(3F-開刀房、門診手術室、門診開刀房、醫療大樓開刀房)',
        'AICU前區', 'AICU後區'
    ]

    @classmethod
    def get_active_departments(cls):
        """Get active department list"""
        return Department.objects.filter(is_active=True).order_by('display_order', 'name')

    @classmethod
    def get_active_waste_types(cls):
        """Get active waste types"""
        return WasteType.objects.filter(is_active=True)

    @classmethod
    def get_department_mapping(cls):
        """Generate department name mapping"""
        return {dept.name: dept.id for dept in cls.get_active_departments()}

    @classmethod
    def get_default_waste_type(cls):
        """Get default waste type for departments - DO NOT auto-create"""
        try:
            # Only get existing waste type, don't create new one
            return WasteType.objects.filter(name='各單位感染廢棄物', is_active=True).first()
        except WasteType.DoesNotExist:
            return None

    @classmethod
    def initialize_default_data(cls):
        """Initialize default data - call this in migration or management command"""
        # Only create departments from default list, no automatic waste types
        for i, dept_name in enumerate(cls.DEFAULT_DEPARTMENTS):
            Department.objects.get_or_create(
                name=dept_name,
                defaults={'display_order': i + 1}
            )

    @classmethod
    def get_configuration_data(cls):
        """Get complete configuration data for frontend"""
        departments = cls.get_active_departments()
        waste_types = cls.get_active_waste_types()

        return {
            'departments': [
                {
                    'id': dept.id,
                    'name': dept.name,
                    'display_order': dept.display_order
                }
                for dept in departments
            ],
            'waste_types': [
                {
                    'id': wt.id,
                    'name': wt.name,
                    'unit': wt.unit
                }
                for wt in waste_types
            ],
            'unit_translations': cls.UNIT_TRANSLATION,
            'department_mapping': cls.get_department_mapping()
        }