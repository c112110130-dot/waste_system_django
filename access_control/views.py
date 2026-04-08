from django.shortcuts import render

# 這就是負責「顯示畫面」的功能
def management_dashboard(request):
    # 這裡告訴 Django 去找哪個 HTML 檔案
    return render(request, 'access_control/dashboard.html')