================================================================================
  醫療廢棄物管理系統 (MWMS) - 部署指南
================================================================================

最後更新：2025-10-30

系統架構：Django 5.1.6 + Gunicorn + Nginx + SQLite (WAL mode)

================================================================================
 快速開始
================================================================================

前置需求
--------
- Ubuntu 22.04 LTS 或更新版本（建議 22.04 或 24.04）
- 有管理員權限 (sudo)
- 網路連線
- 網域名稱（如需使用 HTTPS）
- Python 3.12+ (腳本會自動檢測，低於 3.12 會自動安裝 Python 3.12)


一鍵部署
--------
$ chmod +x initialize.sh
$ ./initialize.sh

腳本會自動完成以下工作：
  1. 檢測 Python 版本，如低於 3.12 則自動安裝 Python 3.12
  2. 安裝所需軟體 (Nginx, Python 等)
  3. 使用適當的 Python 版本建立虛擬環境
  4. 安裝專案依賴套件
  5. 設定環境變數
  6. 建立資料庫
  7. 配置網頁伺服器
  8. 設定 SSL 憑證（如果您已準備好憑證檔案）
  9. 初始化系統資料
 10. 設定日誌自動歸檔
 11. 建立系統服務（可選）


初始化時的選項
--------------
1. SSL 憑證設定：
   選項 1: 使用您已準備好的 SSL 憑證
   選項 2: 跳過（稍後手動設定）

2. 管理員帳號：
   - 系統會詢問您要設定的密碼
   - 自動建立最高權限管理員帳號


啟動伺服器
----------
$ ./start-server.sh

訪問網址: http://您的網域或IP/


停止伺服器
----------
$ ./stop-server.sh


================================================================================
 功能特性說明
================================================================================

1. SSL 憑證支援 (HTTPS 加密連線)
   ----------------------------------
   **什麼是 SSL/HTTPS？**
   就像在網路上加一把鎖，讓資料傳輸更安全。網址列會顯示鎖頭圖示。

   **使用機關提供的 SSL 憑證：**
   - 向您的資訊室取得 SSL 憑證檔案（通常有 2 個檔案）
   - 將憑證檔案放到指定資料夾
   - 系統會自動套用

   **憑證檔案放置位置：**
   系統目錄 /etc/ssl/mwms/
   （initialize.sh 會自動建立此目錄並設定權限）

   **需要的檔案：**
   - 憑證檔案（.pem 或 .crt）
   - 私鑰檔案（.key）

   **重要提醒：**
   - 請妥善保管私鑰檔案，不要外流或上傳到網路！
   - initialize.sh 會自動將憑證複製到系統目錄並設定安全權限


2. 日誌系統
   --------
   **什麼是日誌？**
   就像系統的記事本，記錄所有操作和錯誤訊息。

   **自動記錄的內容：**
   - 誰在什麼時間做了什麼操作（審計日誌）
   - 系統運作的詳細資訊（調試日誌，只在開發模式）
   - 發生的錯誤訊息（錯誤日誌）

   **日誌檔案位置：**
   - logs/latest.log      ← 使用者操作記錄
   - logs/debug.log       ← 系統運作細節（開發用）
   - logs/error.log       ← 錯誤訊息

   **日誌格式：**
   所有日誌都使用統一格式：
   YYYY/MM/DD hh:mm:ss.SSS Z+0800 | [類型] | 詳細訊息

   **自動歸檔：**
   - 每次啟動系統時，舊的日誌會自動打包
   - 打包檔案命名：YYYY-MM-DD-N.tar.gz
   - 每天最多保留 7 個打包檔案
   - 不會無限佔用硬碟空間


3. 資料庫自動初始化
   ----------------
   **第一次啟動時會自動建立：**
   - 43 個預設部門
   - "各單位感染廢棄物" 廢棄物類型

   **安全設計：**
   - 不會刪除您已經輸入的資料
   - 可以重複執行，不會重複新增


4. 使用者權限管理
   ----------------
   **系統會自動建立 5 種權限群組：**
   - root：最高權限管理員
   - moderator：審核人員
   - staff：一般員工
   - registrar：登記人員
   - importer：資料匯入人員

   **首次啟動會建立：**
   一個最高權限的管理員帳號（root 群組）


5. 啟動/停止腳本
   ----------------
   **start-server.sh（啟動）：**
   - 自動檢查是否已經在執行
   - 避免重複啟動造成錯誤

   **stop-server.sh（停止）：**
   - 優雅地關閉伺服器
   - 等待所有工作完成
   - 10 秒後若未關閉會強制結束


6. 動態欄位配置
   ----------------
   **功能說明：**
   可以不改程式碼，直接透過設定檔新增或隱藏欄位。

   **設定檔位置：**
   field_config.json

   **可設定的內容：**
   - 欄位顯示名稱
   - 單位（公噸、公斤、新台幣）
   - 是否顯示
   - 顯示順序
   - 是否可編輯

   **預留欄位：**
   field_1 到 field_10（共 10 個可供未來使用）

   **如何啟用新欄位：**
   1. 用文字編輯器開啟 field_config.json
   2. 找到 field_1（或其他預留欄位）
   3. 將 "visible" 改為 true
   4. 設定 "name"（欄位名稱）
   5. 儲存檔案並刷新頁面後即可套用設定
   
   ! 不要刪除 auto_sum_fields 陣列，它用於自動計算總和 !


================================================================================
 HTTPS 設定（使用機關提供的憑證）
================================================================================

準備工作
--------
1. 向您的資訊室或網管人員取得 SSL 憑證
2. 您應該會拿到 2 個檔案：
   - 憑證檔案（副檔名通常是 .pem, .crt, 或 .cer）
   - 私鑰檔案（副檔名通常是 .key 或 .pem）


放置憑證檔案（手動設定方式）
-----------------------------
注意：如果使用 initialize.sh 部署，SSL 設定會自動完成。
以下步驟僅適用於手動設定或更新憑證時。

1. 建立系統 SSL 目錄：
   $ sudo mkdir -p /etc/ssl/mwms
   $ sudo chmod 700 /etc/ssl/mwms

2. 將憑證檔案複製到系統目錄：
   $ sudo cp 您的憑證檔案.pem /etc/ssl/mwms/cert.pem
   $ sudo cp 您的私鑰檔案.key /etc/ssl/mwms/key.key

3. 設定檔案權限（保護私鑰）：
   $ sudo chmod 640 /etc/ssl/mwms/cert.pem
   $ sudo chmod 640 /etc/ssl/mwms/key.key
   $ sudo chown root:www-data /etc/ssl/mwms/cert.pem
   $ sudo chown root:www-data /etc/ssl/mwms/key.key


設定 Nginx 使用憑證
-------------------
編輯 Nginx 配置檔：
$ sudo nano /etc/nginx/sites-available/mwms

找到 SSL 相關的設定行：
ssl_certificate /etc/ssl/mwms/cert.pem;
ssl_certificate_key /etc/ssl/mwms/key.key;

確認路徑正確後，測試設定：
$ sudo nginx -t

如果顯示 "test is successful"，重新載入 Nginx：
$ sudo systemctl reload nginx


啟用 Django HTTPS 安全選項
---------------------------
編輯 .env.production 檔案：
$ nano .env.production

修改以下設定為 True：
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True

儲存後重新啟動伺服器：
$ ./stop-server.sh && ./start-server.sh


驗證 HTTPS 是否正常
-------------------
用瀏覽器開啟：
https://您的網域.com/

應該會看到：
✓ 瀏覽器網址列顯示鎖頭圖示
✓ 不會出現憑證警告
✓ 輸入 http:// 會自動轉到 https://


憑證更新
--------
**何時需要更新？**
SSL 憑證通常有效期限是 1 年，到期前需要更新。

**如何更新？**
1. 向資訊室取得新的憑證檔案
2. 備份舊憑證：
   $ sudo cp /etc/ssl/mwms/cert.pem /etc/ssl/mwms/cert.pem.old
   $ sudo cp /etc/ssl/mwms/key.key /etc/ssl/mwms/key.key.old
3. 放置新憑證：
   $ sudo cp 新的cert.pem /etc/ssl/mwms/cert.pem
   $ sudo cp 新的key.key /etc/ssl/mwms/key.key
   $ sudo chmod 640 /etc/ssl/mwms/cert.pem
   $ sudo chmod 640 /etc/ssl/mwms/key.key
   $ sudo chown root:www-data /etc/ssl/mwms/cert.pem
   $ sudo chown root:www-data /etc/ssl/mwms/key.key
4. 重新載入 Nginx：
   $ sudo systemctl reload nginx


================================================================================
 常用指令
================================================================================

Django 系統管理
---------------
$ source .venv/bin/activate           # 啟動 Python 環境
$ python manage.py migrate            # 更新資料庫結構
$ python manage.py init_system        # 初始化系統設定
$ python manage.py collectstatic      # 更新網頁檔案


伺服器管理
----------
$ ./start-server.sh                   # 啟動伺服器
$ ./stop-server.sh                    # 停止伺服器
$ sudo systemctl restart mwms         # 重新啟動（如有安裝服務）
$ sudo systemctl status mwms          # 查看運作狀態


查看日誌
--------
$ tail -f logs/latest.log             # 查看使用者操作記錄
$ tail -f logs/debug.log              # 查看系統運作細節
$ tail -f logs/error.log              # 查看錯誤訊息
$ ls -lh logs/*.tar.gz                # 查看歸檔的舊日誌


備份資料庫
----------
**建立備份：**
$ mkdir -p backups
$ cp db.sqlite3 backups/db_$(date +%Y%m%d_%H%M%S).sqlite3
$ cp db.sqlite3-wal backups/ 2>/dev/null || true

**還原備份：**
$ ./stop-server.sh
$ cp backups/db_YYYYMMDD_HHMMSS.sqlite3 db.sqlite3
$ ./start-server.sh


================================================================================
 目錄結構
================================================================================

MedicalWasteManagementSystem/
  |
  +-- .env.production             # 環境設定檔（請勿公開）
  +-- .venv/                      # Python 執行環境
  +-- field_config.json           # 欄位設定檔
  +-- initialize.sh               # 一鍵部署腳本
  +-- start-server.sh             # 啟動伺服器
  +-- stop-server.sh              # 停止伺服器
  +-- gunicorn.conf.py            # 伺服器設定
  +-- db.sqlite3                  # 資料庫
  +-- db.sqlite3-wal              # 資料庫暫存檔
  |
  +-- logs/                       # 日誌資料夾
  |     +-- latest.log            # 目前的操作記錄
  |     +-- debug.log             # 系統運作細節
  |     +-- error.log             # 錯誤訊息
  |     +-- YYYY-MM-DD-N.tar.gz   # 歸檔的舊日誌
  |
  +-- backups/                    # 資料庫備份


================================================================================
 上線前檢查清單
================================================================================

基本設定
--------
[ ] DEBUG 設為 False（.env.production 檔案中）
[ ] SECRET_KEY 已隨機生成
[ ] .env.production 檔案權限設為 600
[ ] ALLOWED_HOSTS 已設定正確的網域或 IP
[ ] 防火牆已開放 80, 443 port
[ ] 防火牆已阻擋 8000 port（不要直接開放）

SSL/HTTPS（如使用）
-------------------
[ ] SSL 憑證檔案已放置到 /etc/ssl/mwms/
[ ] 憑證檔案權限設為 640（sudo chmod 640 /etc/ssl/mwms/cert.pem /etc/ssl/mwms/key.key）
[ ] 憑證檔案所有權正確（sudo chown root:www-data /etc/ssl/mwms/cert.pem /etc/ssl/mwms/key.key）
[ ] Nginx 設定已指向正確的憑證路徑
[ ] HTTPS 安全選項已啟用（.env.production 檔案）
[ ] 瀏覽器可正常顯示 HTTPS 鎖頭

資料與備份
----------
[ ] 已設定定期備份
[ ] 已測試備份還原流程
[ ] 已確認資料庫可正常讀寫

伺服器運作
----------
[ ] Gunicorn 正常執行
[ ] Nginx 正常執行
[ ] 可以正常訪問網站
[ ] 日誌正常記錄


================================================================================
 常見問題排解
================================================================================

問題：無法訪問網站
------------------
**檢查步驟：**

1. 伺服器是否正在執行？
   $ ps aux | grep gunicorn
   （應該看到多個 gunicorn 程序）

2. Nginx 是否正在執行？
   $ sudo systemctl status nginx
   （應該顯示 active (running)）

3. 防火牆是否阻擋？
   $ sudo ufw status
   （80 和 443 port 應該是 ALLOW）

4. 查看錯誤訊息：
   $ tail -f logs/error.log
   $ sudo tail -f /var/log/nginx/error.log


問題：502 Bad Gateway（無法連線）
----------------------------------
**原因：**
Nginx 無法連線到後端的 Gunicorn。

**解決方法：**

1. 檢查 Gunicorn 是否在正確的位址執行：
   $ netstat -tlnp | grep 8000
   （應該看到 127.0.0.1:8000）

2. 查看 Gunicorn 錯誤訊息：
   $ tail -f logs/error.log

3. 重新啟動伺服器：
   $ ./stop-server.sh && ./start-server.sh


問題：SSL 憑證錯誤
------------------
**瀏覽器顯示憑證警告？**

1. 檢查憑證檔案是否存在：
   $ sudo ls -l /etc/ssl/mwms/
   （應該看到 cert.pem 和 key.key）

2. 檢查憑證檔案權限：
   $ sudo ls -l /etc/ssl/mwms/cert.pem /etc/ssl/mwms/key.key
   （應該顯示 -rw-r----- ，即權限 640）

3. 檢查憑證檔案所有權：
   $ sudo ls -l /etc/ssl/mwms/cert.pem /etc/ssl/mwms/key.key
   （應該顯示 root www-data）

4. 檢查 Nginx 設定：
   $ sudo nginx -t
   （應該顯示 test is successful）

5. 檢查憑證是否過期：
   $ sudo openssl x509 -in /etc/ssl/mwms/cert.pem -noout -dates

6. 重新載入 Nginx：
   $ sudo systemctl reload nginx


問題：忘記管理員密碼
--------------------
**解決方法：**

1. 啟動 Python 環境：
   $ source .venv/bin/activate

2. 進入 Django shell：
   $ python manage.py shell

3. 重設密碼：
   >>> from django.contrib.auth.models import User
   >>> user = User.objects.get(username='root')
   >>> user.set_password('新密碼')
   >>> user.save()
   >>> exit()


問題：資料庫鎖定錯誤
--------------------
**原因：**
可能有多個程序同時存取資料庫。

**解決方法：**

1. 停止所有 Gunicorn 程序：
   $ ./stop-server.sh
   $ ps aux | grep gunicorn
   （確認沒有程序還在執行）

2. 重新啟動：
   $ ./start-server.sh


問題：上傳檔案失敗
------------------
**檔案太大無法上傳？**

編輯 Nginx 設定：
$ sudo nano /etc/nginx/sites-available/mwms

找到 client_max_body_size，改成更大的數值：
client_max_body_size 500M;

重新載入 Nginx：
$ sudo systemctl reload nginx


================================================================================
 效能調整
================================================================================

調整 Worker 數量
-----------------
**什麼是 Worker？**
就像是服務窗口的數量，越多可以同時處理越多使用者。

**建議數量：**
(CPU 核心數 × 2) + 1

**如何調整：**

1. 查看您的 CPU 核心數：
   $ nproc
   （例如顯示 4，表示 4 核心）

2. 編輯設定檔：
   $ nano gunicorn.conf.py

3. 修改 workers 數值：
   workers = 9  # 4 核心的話建議 9 個 worker

4. 重新啟動：
   $ ./stop-server.sh && ./start-server.sh


資料庫效能
----------
**系統使用 SQLite 資料庫：**
- 已自動啟用 WAL 模式（提升效能）
- 適合中小型規模（同時使用人數 < 50）
- 如需支援更多使用者，建議升級到 PostgreSQL


================================================================================
 系統需求
================================================================================

硬體需求
--------
- 2 核心以上的 CPU
- 4GB 以上的記憶體
- 20GB 以上的硬碟空間

軟體需求
--------
- Ubuntu 22.04 LTS 或更新版本
  （支援 22.04、24.04、25.10 等）
- Python 3.12+
  * 如系統 Python < 3.12，initialize.sh 會自動安裝 Python 3.12
  * 虛擬環境將使用 Python 3.12 或更高版本
  * 自動使用 deadsnakes PPA 安裝最新穩定版
- Nginx 1.18 或更新版本
- SQLite 3.37 或更新版本


================================================================================
 定期維護
================================================================================

每週維護
--------
[ ] 檢查日誌是否有錯誤訊息
[ ] 檢查硬碟空間是否充足
[ ] 測試資料庫備份是否正常

每月維護
--------
[ ] 更新系統套件（sudo apt update && sudo apt upgrade）
[ ] 檢查 SSL 憑證到期日
[ ] 清理過舊的日誌歸檔和備份
[ ] 檢查資料庫大小和效能

每季維護
--------
[ ] 檢查安全性更新
[ ] 審查使用者存取記錄
[ ] 系統效能分析


================================================================================
 重要提醒
================================================================================

1. 本系統使用 SQLite 資料庫
   - 適合中小型使用規模
   - 已啟用 WAL 模式提升效能
   - 如需更高效能，可升級到 PostgreSQL

2. 請妥善保管 .env.production 檔案
   - 內含系統密鑰，請勿公開
   - 檔案權限應設為 600
   - 不要上傳到網路或版本控制系統

3. SSL 私鑰檔案請小心保管
   - 不要外流或上傳到網路
   - 定期檢查憑證到期日
   - 到期前向資訊室申請新憑證

4. 日誌會自動歸檔
   - 每次啟動時自動打包舊日誌
   - 每天最多保留 7 個歸檔
   - 不會無限佔用硬碟空間

5. 請定期備份資料庫
   - 建議每天自動備份
   - 定期測試備份還原流程
   - 保留至少 30 天的備份


如遇問題無法解決，請先檢查日誌檔案：
  - logs/latest.log          （使用者操作記錄）
  - logs/error.log           （錯誤訊息）
  - /var/log/nginx/error.log （網頁伺服器錯誤）

或參考 MANUAL_SETUP.txt 的詳細步驟。

祝您部署順利！