from django.shortcuts import redirect, render
import json
import logging
from datetime import datetime


from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User, Group
# from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

from django.http import JsonResponse

from django.utils.safestring import mark_safe
from django.utils.timezone import localtime
from django.views.decorators.csrf import csrf_exempt

# 登入頁面
def login_view(request):
    # 這裡未來可以加入檢查帳號密碼的邏輯
    # 目前直接顯示 login.html
    return render(request, 'login.html')

# 主頁面
def index_view(request):
    # 這裡未來可以從資料庫撈數據傳給前端
    return render(request, 'index.html')

# =============================================================
# Account Interface
# =============================================================

def view_login(request):
    login_error = None

    if request.method == 'POST':
        # 檢查是否為訪客模式
        if 'login_as_guest' in request.POST and request.POST['login_as_guest'] == 'true':
            request.session['login_as_guest'] = True
            return redirect('/')

        # 處理正常登入邏輯
        username = request.POST.get('username')
        password = request.POST.get('password')
        if username and password:
            user = authenticate(request, username=username, password=password)
            if user is not None:
                login(request, user)
                # 如果是訪客模式轉正規登入，清除訪客狀態
                if 'login_as_guest' in request.session:
                    del request.session['login_as_guest']
                return redirect('/')
            else:
                login_error = "帳號或密碼錯誤，請重試。"
        else:
            login_error = "請輸入帳號和密碼。"

    # 僅當未登入且未處於訪客模式時顯示登入頁
    # 如果已登入或訪客模式，直接顯示登入頁而非強制跳轉
    return render(request, 'account/login.html', {
        'login_error': login_error
    })

def logout_guest(request):
    if 'login_as_guest' in request.session:
        del request.session['login_as_guest']
    return redirect('/account/login')

def view_logout(request):
    logout(request)
    return redirect('main')

# def view_setting(request):
#     form = PasswordChangeForm(user=request.user)  # 確保 form 存在
#     return render(request, 'account/setting.html', {"form": form})