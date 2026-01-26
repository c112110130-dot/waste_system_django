from django.db import models

# 👇【重要】這裡要改成學長放 User/Department 的那個 APP 名稱
# 假設學長的 APP 叫 'core'，如果叫別的請修改，或者先用字串 'core.User' 參照
from django.conf import settings 

# 如果學長沒用 Django 內建 User，而是自己寫的，請匯入他的 Model
# 這裡先示範最標準的寫法

    
"""
class RealtimeRecord(models.Model):
    
    即時廢棄物紀錄 (我們的新表)
    
    # 紀錄ID (Django 會自動建立隱藏的 id 欄位，不用自己寫)

    # 重量
    weight = models.FloatField(verbose_name="重量(kg)")

    # 過磅時間 (建立時間)
    create_time = models.DateTimeField(auto_now_add=True, verbose_name="過磅時間")

    # 是否被載運
    is_transported = models.BooleanField(default=False, verbose_name="是否被載運")

    # 載運紀錄ID (因為載運是學長的表，我們先用 Integer 存 ID，或是設成 ForeignKey)
    transport_record_id = models.IntegerField(null=True, blank=True, verbose_name="載運紀錄ID")

    # 更新時間
    update_time = models.DateTimeField(auto_now=True, verbose_name="更新時間")

    # --- 外鍵區 (關聯到別人的表) ---

    # 過磅人員 (建立者)
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL, # 這會自動連到系統的使用者表
        on_delete=models.CASCADE,
        related_name='created_records',
        verbose_name="過磅人員"
    )

    # 更新人員
    updater = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, # 人員被刪除時，紀錄保留，只是變空
        null=True, blank=True,
        related_name='updated_records',
        verbose_name="更新人員"
    )

    # 定點、部門、廢棄物種類
    # ⚠️ 注意：這三個需要引用學長的 Model，如果暫時找不到，可以先用 IntegerField 頂著
    # 這裡示範用「字串參照」的方式，假設學長的 APP 叫 'waste_app'
    # location = models.ForeignKey('waste_app.LocationPoint', on_delete=models.CASCADE)

    # 先用簡單版 (存 ID)，等你確定學長 APP 名稱再來改 FK
    location_id = models.IntegerField(verbose_name="定點ID")
    dept_id = models.IntegerField(verbose_name="部門ID")
    waste_type_id = models.IntegerField(verbose_name="廢棄物種類ID")

    class Meta:
        db_table = 'realtime_record' # 資料庫裡的表格名稱
        verbose_name = "即時廢棄物紀錄"
"""
"""
class Group(models.Model):
    group_id = models.AutoField(primary_key=True)                  # 群組ID
    permission = models.JSONField()                          # 權限表

    class Meta:
        db_table = 'group' # 資料庫裡的表格名稱
        verbose_name = "使用者群組"
""" 
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
"""
class User(models.Model):
    user_id = models.AutoField(primary_key=True)                   # 使用者ID
    user_code = models.CharField(max_length=20, unique=True)  # 使用者代碼
    account = models.CharField(max_length=50, unique=True)    # 使用者帳號
    password = models.CharField(max_length=255)               # 使用者密碼
    full_name = models.CharField(max_length=100)              # 使用者名稱
    email = models.EmailField(unique=True)                    # 電子郵箱

    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE
    )  # 部門ID（外來鍵）

    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE
    )  # 群組ID（外來鍵）
    created_at = models.DateTimeField(auto_now_add=True)       # 建立時間
    class Meta:
        db_table = 'user' # 資料庫裡的表格名稱
        verbose_name = "使用者"
"""
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
    settlement_staff = models.ForeignKey(
        settings.AUTH_USER_MODEL, # 這會自動連到系統的使用者表
        on_delete=models.CASCADE,
        related_name='transport_records',
        verbose_name="結算人員"
    ) #使用者ID (外來鍵)
    clearAgency = models.ForeignKey(
        clearAgency,
        on_delete=models.CASCADE
    ) #清理機構ID
    processAgency = models.ForeignKey(
        processAgency,
        on_delete=models.CASCADE
    ) #處理機構ID
    settlement_time = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'transport_record' # 資料庫裡的表格名稱
        verbose_name = "載運紀錄"

class WasteRecord(models.Model):
    id = models.AutoField(primary_key=True)
    is_transported = models.BooleanField(default=False)
    is_expired = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=True)
    weight = models.DecimalField(max_digits=10,decimal_places=2)
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE
    )  # 部門ID（外來鍵）
    location = models.ForeignKey(
        LocationPoint,
        on_delete=models.CASCADE
    )  # 定點ID（外來鍵）
    TransportRecord = models.ForeignKey(
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
