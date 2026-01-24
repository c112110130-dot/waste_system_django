# 單位：
#     percent: 百分比
#     person_count: 人數
#     person_times: 人次

from django.db import models

class HospitalOperationalData(models.Model):  # 醫院營運數據表
    date = models.CharField(max_length=7, primary_key=True)  # YYYY-MM
    bed_occupancy_rate = models.FloatField(null=True, blank=True)  # 佔床率，以百分比儲存 (e.g., 85.50)
    surgical_cases = models.IntegerField(null=True, blank=True)  # 手術人次
    doctor_count = models.IntegerField(null=True, blank=True)  # 醫師人數
    nurse_count = models.IntegerField(null=True, blank=True)  # 護理人數
    total_staff_count = models.IntegerField(null=True, blank=True)  # 全院員工數
    outpatient_visits = models.IntegerField(null=True, blank=True)  # 門診人次
    emergency_visits = models.IntegerField(null=True, blank=True)  # 急診人次
    inpatient_visits = models.IntegerField(null=True, blank=True)  # 住院人次
    medical_waste_total = models.FloatField(null=True, blank=True)  # 廢棄物總量

    class Meta:
        db_table = 'hospital_operational_data'
        verbose_name = "醫院廢棄物因子"
        verbose_name_plural = "醫院廢棄物因子"

    # 欄位名稱與單位定義
    FIELD_INFO = {
        'bed_occupancy_rate': {'name': '佔床率', 'unit': 'percent'},
        'surgical_cases': {'name': '手術人次', 'unit': 'person_times'},
        'doctor_count': {'name': '醫師人數', 'unit': 'person_count'},
        'nurse_count': {'name': '護理人數', 'unit': 'person_count'},
        'total_staff_count': {'name': '全院員工數', 'unit': 'person_count'},
        'outpatient_visits': {'name': '門診人次', 'unit': 'person_times'},
        'emergency_visits': {'name': '急診人次', 'unit': 'person_times'},
        'inpatient_visits': {'name': '住院人次', 'unit': 'person_times'},
        'medical_waste_total': {'name': '廢棄物總量', 'unit': 'kilogram'},
    }