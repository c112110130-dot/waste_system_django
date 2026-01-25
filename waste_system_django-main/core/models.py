from django.db import models

# Create your models here.
class Group(models.Model):
    group_id = models.AutoField(primary_key=True)                  # 群組ID
    permission = models.JSONField()                          # 權限表

    def __str__(self):
        return self.id
    
class Department(models.Model):
    department_id = models.AutoField(primary_key=True)                  # 部門ID
    department_code = models.CharField(max_length=100)       # 部門代碼
    department_name = models.CharField(max_length=100)       # 部門名稱
    created_at = models.DateTimeField(auto_now_add=True)     # 建立時間

    def __str__(self):
        return self.department_name

class LocationPoint(models.Model):
    location_id = models.AutoField(primary_key=True)        # 定點ID
    location_code = models.CharField(max_length=100)       # 定點代碼
    location_name = models.CharField(max_length=100)       # 定點名稱
    created_at = models.DateTimeField(auto_now_add=True)     # 建立時間   
    def __str__(self):
        return self.location_name
    
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
    def __str__(self):
        return self.full_name

class clearAgency(models.Model):
    clearAgency_id = models.AutoField(primary_key=True)        #清理機構ID
    clearAgency_code = models.CharField(max_length=100)        #清理機構代碼
    clearAgency_name = models.CharField(max_length=100)        #清理機構名稱

class processAgency(models.Model):
    processAgency_id = models.AutoField(primary_key=True)      #處理機構ID
    processAgency_code = models.CharField(max_length=100)      #處理機構代碼
    processAgency_name = models.CharField(max_length=100)      #處理機構名稱

class TransportRecord(models.Model):
    transport_id = models.AutoField(primary_key=True)          
    settlement_staff_id = models.ForeignKey(
        User,
        on_delete=models.CASCADE
    ) #使用者ID (外來鍵)
    clearAgency_id = models.ForeignKey(
        clearAgency,
        on_delete=models.CASCADE
    ) #清理機構ID
    processAgency_id = models.ForeignKey(
        processAgency,
        on_delete=models.CASCADE
    ) #處理機構ID
    settlement_time = models.DateTimeField(auto_now_add=True)

class wasteRecord(models.Model):
    wasterecord_id = models.AutoField(primary_key=True)
    transport = models.BooleanField(default=False)
    weight = models.DecimalField(max_digits=10,decimal_places=2)
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE
    )  # 部門ID（外來鍵）
    locationPoint = models.ForeignKey(
        LocationPoint,
        on_delete=models.CASCADE
    )  # 定點ID（外來鍵）
    TransportRecord_id = models.ForeignKey(
        TransportRecord,
        on_delete=models.CASCADE
    )
    Weighing_personnel = models.CharField(max_length=100)
    update_personnel = models.ForeignKey(
        User,
        on_delete=models.CASCADE
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="過磅時間")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新時間")

class WasteType(models.Model):
    WasteType_id = models.AutoField(primary_key=True)
    WasteType_name = models.CharField(max_length=100)
    measurement = models.CharField(max_length=20)
    wasteRecord_id = models.ForeignKey(
        wasteRecord,
        on_delete=models.CASCADE
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="建立時間")
