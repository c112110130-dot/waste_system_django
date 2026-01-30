from django.db import models
from django.db.models import Sum  # 記得引入 Sum
# 👇【重要】這裡要改成學長放 User/Department 的那個 APP 名稱
# 假設學長的 APP 叫 'core'，如果叫別的請修改，或者先用字串 'core.User' 參照
from django.conf import settings 


class Department(models.Model):
    id = models.AutoField(primary_key=True)                  # 部門ID
    code = models.CharField(max_length=100)       # 部門代碼
    name = models.CharField(max_length=100)       # 部門名稱
    created_time = models.DateTimeField(auto_now_add=True)     # 建立時間

    class Meta:
        db_table = 'department' # 資料庫裡的表格名稱
        verbose_name = "部門"

class LocationPoint(models.Model):
    id = models.AutoField(primary_key=True)        # 定點ID
    code = models.CharField(max_length=100)       # 定點代碼
    name = models.CharField(max_length=100)       # 定點名稱
    created_time = models.DateTimeField(auto_now_add=True)     # 建立時間   
    class Meta:
        db_table = 'location' # 資料庫裡的表格名稱
        verbose_name = "定點"

class clearAgency(models.Model):
    id = models.AutoField(primary_key=True)        #清理機構ID
    code = models.CharField(max_length=100)        #清理機構代碼
    name = models.CharField(max_length=100)        #清理機構名稱
    class Meta:
        db_table = 'clear_agency' # 資料庫裡的表格名稱
        verbose_name = "清理機構"

class processAgency(models.Model):
    id = models.AutoField(primary_key=True)      #處理機構ID
    code = models.CharField(max_length=100)      #處理機構代碼
    name = models.CharField(max_length=100)      #處理機構名稱
    class Meta:
        db_table = 'process_agency' # 資料庫裡的表格名稱
        verbose_name = "處理機構"

class TransportRecord(models.Model):
    id = models.AutoField(primary_key=True)          
    settler = models.ForeignKey(
        settings.AUTH_USER_MODEL, # 這會自動連到系統的使用者表
        on_delete=models.CASCADE,
        related_name='transport_records',
        verbose_name="結算人員"
    ) #使用者ID (外來鍵)
    clear_agency = models.ForeignKey(
        clearAgency,
        on_delete=models.CASCADE
    ) #清理機構ID
    process_agency = models.ForeignKey(
        processAgency,
        on_delete=models.CASCADE
    ) #處理機構ID
    settle_time = models.DateTimeField(auto_now_add=True)
    @property
    def total_weight(self):
        result = self.wasterecord_set.aggregate(total=Sum('weight'))
        return result['total'] or 0
    @property
    def items(self):
        return self.wasterecord_set.all()
    @property
    def item_count(self):
        return self.wasterecord_set.count()
    class Meta:
        db_table = 'transport_record' # 資料庫裡的表格名稱
        verbose_name = "載運紀錄"

class WasteRecord(models.Model):
    id = models.AutoField(primary_key=True)
    is_transported = models.BooleanField(default=False)
    is_expired = models.BooleanField(default=False)
    def can_delete(self):
        return not self.is_transported and not self.is_expired
    weight = models.DecimalField(max_digits=10,decimal_places=2)
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE
    )  # 部門ID（外來鍵）
    location = models.ForeignKey(
        LocationPoint,
        on_delete=models.CASCADE
    )  # 定點ID（外來鍵）
    transportrecord = models.ForeignKey(
        TransportRecord,
        null=True, blank=True,
        on_delete=models.SET_NULL
    )
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL, # 這會自動連到系統的使用者表
        on_delete=models.CASCADE,
        related_name='created_records',
        verbose_name="過磅人員"
    )  # 過磅人員 (建立者)
        
    updater = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, # 人員被刪除時，紀錄保留，只是變空
        null=True, blank=True,
        related_name='updated_records',
        verbose_name="更新人員"
    )

    create_time = models.DateTimeField(auto_now_add=True, verbose_name="過磅時間")
    update_time = models.DateTimeField(auto_now=True, verbose_name="更新時間")
    class Meta:
        db_table = 'waste_record' # 資料庫裡的表格名稱
        verbose_name = "廢棄物紀錄"

class WasteType(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    measurement = models.CharField(max_length=20)
    wasteRecord_id = models.ForeignKey(
        WasteRecord,
        on_delete=models.CASCADE
    )
    created_time = models.DateTimeField(auto_now_add=True, verbose_name="建立時間")
    class Meta:
        db_table = 'waste_type' # 資料庫裡的表格名稱
        verbose_name = "廢棄物種類"
