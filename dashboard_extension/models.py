from django.db import models
# 👇【重要】這裡要改成學長放 User/Department 的那個 APP 名稱
# 假設學長的 APP 叫 'core'，如果叫別的請修改，或者先用字串 'core.User' 參照
from django.conf import settings 

# 如果學長沒用 Django 內建 User，而是自己寫的，請匯入他的 Model
# 這裡先示範最標準的寫法

class RealtimeRecord(models.Model):
    """
    即時廢棄物紀錄 (我們的新表)
    """
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