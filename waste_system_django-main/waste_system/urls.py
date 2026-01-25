from django.contrib import admin
from django.urls import path
from core import views  # 匯入您的視圖

# --- 必須匯入這兩個模組來處理靜態檔案 ---
from django.conf import settings
from django.conf.urls.static import static
# --------------------------------------

urlpatterns = [
    path('admin/', admin.site.urls),
    path('login/', views.login_view, name='login'), # 登入頁
    path('', views.index_view, name='index'),       # 首頁
]

# --- [關鍵] 在開發模式下，讓 Django 幫忙送出 CSS/JS ---
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATICFILES_DIRS[0])