import json
import logging
from datetime import datetime

import pytz
from dateutil.relativedelta import relativedelta
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User, Group
# from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction, models, IntegrityError
from django.http import JsonResponse
from django.shortcuts import render, redirect
from django.utils.safestring import mark_safe
from django.utils.timezone import localtime
from django.views.decorators.csrf import csrf_exempt, csrf_protect
from django.views.decorators.http import require_http_methods

from MedicalWasteManagementSystem.permissions import *
from MedicalWasteManagementSystem.utils import QueryOptimizer, CacheManager
from MedicalWasteManagementSystem.error_handler import handle_error
from WasteManagement.models import (
    GeneralWasteProduction,
    BiomedicalWasteProduction,
    DialysisBucketSoftBagProductionAndDisposalCosts,
    PharmaceuticalGlassProductionAndDisposalCosts,
    PaperIronAluminumCanPlasticAndGlassProductionAndRecyclingRevenue,
    Department,
    WasteType
)
from .models import UserProfile
from .forms import PasswordChangeForm

# Create your views here.

# =============================================================
# Main Menu
# =============================================================

# Set up logging
logger = logging.getLogger(__name__)


def index(request):
    """Render the main menu page with embedded chart data aligned with frontend logic."""
    login_as_guest = request.session.get('login_as_guest', False)

    # Fetch server time in Asia/Taipei to match frontend
    now = datetime.now(pytz.utc).astimezone(pytz.timezone('Asia/Taipei'))
    current_day = now.day
    cutoff_day = 5

    # Determine end month: < 5th shows 2 months ago, >= 5th shows previous month
    if current_day < cutoff_day:
        end_month = now - relativedelta(months=2)  # 2 months ago
    else:
        end_month = now - relativedelta(months=1)  # Previous month
    display_month = end_month.strftime('%Y-%m')  # For summary data
    # Generate 12-month range ending at end_month
    start_month = end_month - relativedelta(months=11)
    last_year = []
    current = start_month
    while current <= end_month:
        last_year.append(current.strftime('%Y-%m'))
        current += relativedelta(months=1)
    logger.info(f"Server time: {now}, Display month: {display_month}, Last 12 months: {last_year}")

    # Summary data (single month) - optimized batch fetch
    models_to_fetch = [
        (GeneralWasteProduction, 'general'),
        (BiomedicalWasteProduction, 'biomedical'),
        (DialysisBucketSoftBagProductionAndDisposalCosts, 'dialysis'),
        (PharmaceuticalGlassProductionAndDisposalCosts, 'phar_glass')
    ]
    
    # Use optimized batch fetch from cache or database
    cache_key = f"dashboard_summary_{display_month}"
    summary_models = CacheManager.get_or_set(
        cache_key,
        lambda: QueryOptimizer.batch_fetch_by_date(models_to_fetch, display_month),
        'dashboard_data'
    )
    
    general = summary_models.get('general')
    biomedical = summary_models.get('biomedical')
    dialysis = summary_models.get('dialysis')
    phar_glass = summary_models.get('phar_glass')
    summary_data = {
        'year': display_month.split('-')[0],
        'month': int(display_month.split('-')[1]),
        'general_tainan': general.tainan if general and general.tainan is not None else None,
        'general_renwu': general.renwu if general and general.renwu is not None else None,
        'biomed_red': biomedical.red_bag if biomedical and biomedical.red_bag is not None else None,
        'biomed_yellow': biomedical.yellow_bag if biomedical and biomedical.yellow_bag is not None else None,
        'cost_dialysis': dialysis.cost if dialysis and dialysis.cost is not None else None,
        'cost_phar_glass': phar_glass.cost if phar_glass and phar_glass.cost is not None else None
    }
    logger.info(f"Summary data: {summary_data}")

    # Helper function to pad or align data arrays to match last_year length
    def pad_data(entries, field, labels=last_year):
        entries_dict = {e.date: getattr(e, field, 0) or 0 for e in entries}
        return [entries_dict.get(label, 0) for label in labels]

    # Recycle data
    recycle_entries = PaperIronAluminumCanPlasticAndGlassProductionAndRecyclingRevenue.objects.filter(
        date__in=last_year).order_by('date')
    logger.info(f"Recycle entries count: {recycle_entries.count()}, Dates: {[e.date for e in recycle_entries]}")
    recycle_data = {
        'lastMonth': {
            'labels': ['紙', '鐵鋁罐', '塑膠', '玻璃'],
            'data': [getattr(recycle_entries.filter(date=display_month).first(), f, 0) or 0 for f in
                     ['paper_produced', 'iron_aluminum_can_produced', 'plastic_produced', 'glass_produced']],
            'title': f'上月({display_month})回收物質產量'
        },
        'last12Months': {
            'labels': last_year,
            'datasets': {
                '紙': {'data': pad_data(recycle_entries, 'paper_produced'), 'color': '#FF6384'},
                '鐵鋁罐': {'data': pad_data(recycle_entries, 'iron_aluminum_can_produced'), 'color': '#36A2EB'},
                '塑膠': {'data': pad_data(recycle_entries, 'plastic_produced'), 'color': '#FFCE56'},
                '玻璃': {'data': pad_data(recycle_entries, 'glass_produced'), 'color': '#4BC0C0'}
            },
            'title': '近12月回收物質產量'
        },
        'revenue12Months': {
            'labels': last_year,
            'data': pad_data(recycle_entries, 'recycling_revenue'),
            'title': '近12月回收收入'
        }
    }

    # General waste data - dynamically load visible fields from config
    general_entries = GeneralWasteProduction.objects.filter(date__in=last_year).order_by('date')
    logger.info(f"General entries count: {general_entries.count()}, Dates: {[e.date for e in general_entries]}")

    # Load field configuration
    field_config = GeneralWasteProduction.get_field_config()
    visible_fields = GeneralWasteProduction.get_visible_fields()

    # Define color palette for dynamic fields
    color_palette = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
        '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF',
        '#4BC0C0', '#FF6384', '#36A2EB', '#FFCE56'
    ]

    # Build datasets dynamically from visible fields (exclude 'total')
    datasets = {}
    color_index = 0
    for field_name, field_info in visible_fields.items():
        if field_name != 'total':  # Skip total field
            datasets[field_info['name']] = {
                'data': pad_data(general_entries, field_name),
                'color': color_palette[color_index % len(color_palette)]
            }
            color_index += 1

    general_data = {
        'last12Months': {
            'labels': last_year,
            'datasets': datasets,
            'total': pad_data(general_entries, 'total'),
            'title': '近12月一般事業廢棄物產量'
        }
    }

    # Biomedical waste data
    biomedical_entries = BiomedicalWasteProduction.objects.filter(date__in=last_year).order_by('date')
    dialysis_entries = DialysisBucketSoftBagProductionAndDisposalCosts.objects.filter(date__in=last_year).order_by(
        'date')
    logger.info(
        f"Biomedical entries count: {biomedical_entries.count()}, Dialysis entries count: {dialysis_entries.count()}")
    biomedical_data = {
        'last12Months': {
            'labels': last_year,
            'datasets': {
                '紅袋': {'data': pad_data(biomedical_entries, 'red_bag'), 'color': '#FF6384'},
                '黃袋': {'data': pad_data(biomedical_entries, 'yellow_bag'), 'color': '#FFCE56'}
            },
            'total': pad_data(biomedical_entries, 'total'),
            'title': '近12月生物醫療廢棄物產量'
        },
        'dialysis12Months': {
            'labels': last_year,
            'datasets': {
                '洗腎桶': {'data': pad_data(dialysis_entries, 'produced_dialysis_bucket'), 'color': '#36A2EB'},
                '軟袋': {'data': pad_data(dialysis_entries, 'produced_soft_bag'), 'color': '#4BC0C0'}
            },
            'costs': pad_data(dialysis_entries, 'cost')
        }
    }

    # Pharmaceutical glass data
    phar_glass_entries = PharmaceuticalGlassProductionAndDisposalCosts.objects.filter(date__in=last_year).order_by(
        'date')
    logger.info(
        f"Phar glass entries count: {phar_glass_entries.count()}, Dates: {[e.date for e in phar_glass_entries]}")
    phar_glass_data = {
        'last12Months': {
            'labels': last_year,
            'data': pad_data(phar_glass_entries, 'produced'),
            'costs': pad_data(phar_glass_entries, 'cost'),
            'title': '近12月藥用玻璃產量'
        }
    }

    # Combine all context data for template
    context = {
        'login_as_guest': login_as_guest,
        'summary_data': summary_data,
        'summary_data_json': mark_safe(json.dumps(summary_data)),
        'recycle_data_json': mark_safe(json.dumps(recycle_data)),
        'general_data_json': mark_safe(json.dumps(general_data)),
        'biomedical_data_json': mark_safe(json.dumps(biomedical_data)),
        'phar_glass_data_json': mark_safe(json.dumps(phar_glass_data))
    }
    return render(request, 'main_menu.html', context)


def extended_chart_data(request):
    """Render extended chart data (24 months) for maximized chart view."""
    # Fetch server time in Asia/Taipei to match frontend
    now = datetime.now(pytz.utc).astimezone(pytz.timezone('Asia/Taipei'))

    # Calculate the 24-month range ending at current month
    end_month = now - relativedelta(months=1)  # Previous month
    start_month = end_month - relativedelta(months=23)  # 24 months range

    # Generate date range
    last_24_months = []
    current = start_month
    while current <= end_month:
        last_24_months.append(current.strftime('%Y-%m'))
        current += relativedelta(months=1)

    logger.info(
        f"Extended date range: {last_24_months[0]} to {last_24_months[-1]}, Total months: {len(last_24_months)}")

    # Helper function to pad or align data arrays to match last_24_months length
    def pad_data(entries, field, labels=last_24_months):
        entries_dict = {e.date: getattr(e, field, 0) or 0 for e in entries}
        return [entries_dict.get(label, 0) for label in labels]

    # Fetch data for all waste types for the 24 month period
    recycle_entries = PaperIronAluminumCanPlasticAndGlassProductionAndRecyclingRevenue.objects.filter(
        date__in=last_24_months).order_by('date')
    general_entries = GeneralWasteProduction.objects.filter(date__in=last_24_months).order_by('date')
    biomedical_entries = BiomedicalWasteProduction.objects.filter(date__in=last_24_months).order_by('date')
    dialysis_entries = DialysisBucketSoftBagProductionAndDisposalCosts.objects.filter(date__in=last_24_months).order_by(
        'date')
    phar_glass_entries = PharmaceuticalGlassProductionAndDisposalCosts.objects.filter(date__in=last_24_months).order_by(
        'date')

    # Recycle data
    recycle_data = {
        'last24Months': {
            'labels': last_24_months,
            'datasets': {
                '紙': {'data': pad_data(recycle_entries, 'paper_produced'), 'color': '#FF6384'},
                '鐵鋁罐': {'data': pad_data(recycle_entries, 'iron_aluminum_can_produced'), 'color': '#36A2EB'},
                '塑膠': {'data': pad_data(recycle_entries, 'plastic_produced'), 'color': '#FFCE56'},
                '玻璃': {'data': pad_data(recycle_entries, 'glass_produced'), 'color': '#4BC0C0'}
            }
        },
        'revenue24Months': {
            'labels': last_24_months,
            'data': pad_data(recycle_entries, 'recycling_revenue')
        }
    }

    # General waste data - dynamically load visible fields from config
    field_config = GeneralWasteProduction.get_field_config()
    visible_fields = GeneralWasteProduction.get_visible_fields()

    # Define color palette for dynamic fields
    color_palette = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
        '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF',
        '#4BC0C0', '#FF6384', '#36A2EB', '#FFCE56'
    ]

    # Build datasets dynamically from visible fields (exclude 'total')
    datasets_24 = {}
    color_index = 0
    for field_name, field_info in visible_fields.items():
        if field_name != 'total':  # Skip total field
            datasets_24[field_info['name']] = {
                'data': pad_data(general_entries, field_name),
                'color': color_palette[color_index % len(color_palette)]
            }
            color_index += 1

    general_data = {
        'last24Months': {
            'labels': last_24_months,
            'datasets': datasets_24,
            'total': pad_data(general_entries, 'total')
        }
    }

    # Biomedical waste data
    biomedical_data = {
        'last24Months': {
            'labels': last_24_months,
            'datasets': {
                '紅袋': {'data': pad_data(biomedical_entries, 'red_bag'), 'color': '#FF6384'},
                '黃袋': {'data': pad_data(biomedical_entries, 'yellow_bag'), 'color': '#FFCE56'}
            },
            'total': pad_data(biomedical_entries, 'total')
        },
        'dialysis24Months': {
            'labels': last_24_months,
            'datasets': {
                '洗腎桶': {'data': pad_data(dialysis_entries, 'produced_dialysis_bucket'), 'color': '#36A2EB'},
                '軟袋': {'data': pad_data(dialysis_entries, 'produced_soft_bag'), 'color': '#4BC0C0'}
            },
            'costs': pad_data(dialysis_entries, 'cost')
        }
    }

    # Pharmaceutical glass data
    phar_glass_data = {
        'last24Months': {
            'labels': last_24_months,
            'data': pad_data(phar_glass_entries, 'produced'),
            'costs': pad_data(phar_glass_entries, 'cost')
        }
    }

    return JsonResponse({
        'recycle': recycle_data,
        'general': general_data,
        'biomedical': biomedical_data,
        'pharGlass': phar_glass_data
    })


def server_time(request):
    current_server_time = datetime.now(pytz.utc).isoformat()  # Get server time in UTC
    return JsonResponse({"serverTime": current_server_time})


# =============================================================
# Theme Settings
# =============================================================

@csrf_protect
@require_http_methods(["POST"])
def set_theme(request):
    """Handle theme setting save to database"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            theme = data.get('theme')

            # Validate theme value
            if theme not in ['system', 'light', 'dark']:
                return JsonResponse({'success': False, 'error': '無效的主題設定'}, status=400)

            # If user is authenticated, save to database
            if request.user.is_authenticated:
                profile, created = UserProfile.objects.get_or_create(user=request.user)
                profile.theme_preference = theme
                profile.save()
                logger.info(f"User {request.user.username} set theme to: {theme}")

            return JsonResponse({'success': True, 'theme': theme})

        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'error': '無效的JSON格式'}, status=400)
        except Exception as e:
            logger.error(f"Error setting theme: {str(e)}")
            return JsonResponse({'success': False, 'error': '伺服器內部錯誤'}, status=500)

    return JsonResponse({'success': False, 'error': '無效的請求方法'}, status=405)


def get_theme(request):
    """Get current user's theme setting from database"""
    if request.user.is_authenticated:
        profile, created = UserProfile.objects.get_or_create(user=request.user)
        theme = profile.theme_preference
    else:
        theme = 'system'  # Default to system for unauthenticated users

    return JsonResponse({'theme': theme})


# =============================================================
# Account Interface
# =============================================================

def view_login(request):
    login_error = None

    if request.method == 'POST':
        # Check if guest mode
        if 'login_as_guest' in request.POST and request.POST['login_as_guest'] == 'true':
            request.session['login_as_guest'] = True
            return redirect('/')

        # Handle normal login logic
        username = request.POST.get('username')
        password = request.POST.get('password')
        if username and password:
            user = authenticate(request, username=username, password=password)
            if user is not None:
                login(request, user)
                # If switching from guest mode to normal login, clear guest status
                if 'login_as_guest' in request.session:
                    del request.session['login_as_guest']
                return redirect('/')
            else:
                login_error = "帳號或密碼錯誤，請重試。"
        else:
            login_error = "請輸入帳號和密碼。"

    # Only show login page when not logged in and not in guest mode
    # If already logged in or in guest mode, show login page directly without forced redirect
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

# Change user password
@login_required
def change_password(request):
    if request.method == "POST":
        # Log POST data for debugging (hide passwords)
        post_data = {k: '***' if 'password' in k else v for k, v in request.POST.items()}
        logger.info(f"Password change request received with fields: {post_data.keys()}")

        # Use Django's PasswordChangeForm to handle form
        form = PasswordChangeForm(user=request.user, data=request.POST)

        if form.is_valid():
            try:
                user = form.save()
                # Password changed, but keep user session active
                update_session_auth_hash(request, user)
                logger.info(f"Password changed successfully for user: {request.user.username}")
                return JsonResponse({"success": True})
            except Exception as e:
                return handle_error(
                    e,
                    user_message="密碼變更失敗，請稍後再試",
                    log_context={'user': request.user.username, 'action': 'change_password'},
                    status=500
                )
        else:
            # Log form errors in detail
            logger.warning(f"Password change form validation failed: {form.errors}")

            # Format errors for frontend display
            errors = {}
            for field, error_list in form.errors.items():
                errors[field] = [str(error) for error in error_list]

            return JsonResponse({"success": False, "errors": errors}, status=400)

    # GET request shows form
    form = PasswordChangeForm(user=request.user)
    return render(request, "account/setting.html", {"form": form})


# Left account menu list
@permission_required('moderator')
def view_account_manage_list(request):
    # Define group name order and corresponding icons
    permission_order = ['root', 'moderator', 'staff', 'registrar', 'importer', 'not-defined']
    permission_icons = {
        'root': 'gear',
        'moderator': 'user-shield',
        'staff': 'users',
        'registrar': 'file-pen',
        'importer': 'file-import',
        'not-defined': 'question'
    }

    # Query groups and sort in Python
    permissions = Group.objects.filter(name__in=permission_order[:-1])  # Exclude 'not-defined'
    groups = sorted(permissions, key=lambda g: permission_order.index(g.name))

    # Build mapping of groups to members
    permission_types = {group.name: group.user_set.all() for group in groups}

    # Find all users
    all_users = User.objects.all()

    # Find users with assigned groups
    users_with_groups = set()
    for users in permission_types.values():
        users_with_groups.update(users)

    # Find users without assigned groups
    users_without_group = [user for user in all_users if user not in users_with_groups]

    # Add users without groups to 'not-defined'
    permission_types['not-defined'] = users_without_group

    # Ensure all group names exist in dictionary, even if members are empty
    permission_types = {name: permission_types.get(name, []) for name in permission_order}

    # Pass to template
    return render(request, 'account/manage.html', {
        'permission_icons': permission_icons,
        'permission_types': permission_types,
        'current_user': request.user
    })


# Right account info panel/personal account management info
@login_required
def view_account_manage_info(request, account_id):
    user_level = get_permission_hi(request.user, id=True)
    logger.debug(f"Account access request: account_id={account_id}, user_level={user_level}")
    if request.user.username == account_id or user_level >= GROUP_HIERARCHY["moderator"]:
        try:
            account = User.objects.get(username=account_id)
            account_data = {
                'username': account.username,
                'first_name': account.first_name,
                'last_name': account.last_name,
                'group': account.groups.first().name if account.groups.exists() else "",
                'is_superuser': account.is_superuser,
                'is_staff': account.is_staff,
                'date_joined': localtime(account.date_joined).strftime("%Y-%m-%d %H:%M:%S.%f %z"),
                'last_login': localtime(account.last_login).strftime("%Y-%m-%d %H:%M:%S.%f %z") if account.last_login else '',
            }
            return JsonResponse({'success': True, 'data': account_data})
        except User.DoesNotExist:
            return JsonResponse({'error': 'Account not found'}, status=404)
    else:
        return JsonResponse({'error': 'Permission denied'}, status=403)


# Account deletion
@csrf_protect
@require_http_methods(["DELETE"])
@permission_required('moderator')
def delete_account(request, username):
    if request.method == 'DELETE':
        try:
            with transaction.atomic():  # Use transaction to ensure consistency
                current_user = request.user
                target_user = User.objects.get(username=username)

                if target_user == current_user:
                    return JsonResponse({'success': False, 'error': '不能刪除自己的帳號'}, status=403)

                current_user_group_name = current_user.groups.first().name if current_user.groups.exists() else None
                target_user_group_name = target_user.groups.first().name if target_user.groups.exists() else None

                if current_user_group_name not in GROUP_HIERARCHY or target_user_group_name not in GROUP_HIERARCHY:
                    return JsonResponse({'success': False, 'error': '群組配置無效，請聯繫管理員'}, status=500)

                if GROUP_HIERARCHY[current_user_group_name] <= GROUP_HIERARCHY[target_user_group_name]:
                    return JsonResponse({'success': False, 'error': '權限不足，無法刪除此帳號'}, status=403)

                target_user.delete()
                return JsonResponse({'success': True})

        except User.DoesNotExist:
            return JsonResponse({'success': False, 'error': '目標帳號不存在'}, status=404)
        except Exception as e:
            # Log other exceptions and return error
            print(f"Error deleting account: {e}")
            return JsonResponse({'success': False, 'error': '伺服器內部錯誤'}, status=500)
    return JsonResponse({'success': False, 'error': '無效的請求方法'}, status=405)


@permission_required('moderator')
def view_account_register(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        email = request.POST.get('email')
        first_name = request.POST.get('first_name')
        last_name = request.POST.get('last_name')
        password = request.POST.get('password')
        permission = request.POST.get('permission')

        # Check required fields
        if not username or not password or not permission:
            return JsonResponse({'success': False, 'error': '請填寫所有必填項目！'})

        try:
            # Create user
            user = User.objects.create_user(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name,
                password=password
            )

            # Confirm group exists and assign
            user_permission = Group.objects.get(name=permission)
            user.groups.add(user_permission)

            return JsonResponse({'success': True})
        except (Exception, ValidationError) as e:
            # Return error message
            return JsonResponse({'success': False, 'error': str(e)})

    # Dynamically adjust dropdown options
    user = request.user
    permission_options = []
    if user.groups.filter(name='root').exists():
        permission_options = ['moderator', 'staff', 'registrar', 'importer']
    elif user.groups.filter(name='moderator').exists():
        permission_options = ['staff', 'registrar', 'importer']

    return render(request, 'account/register.html', {'permission_options': permission_options})


# =============================================================
# Database Settings
# =============================================================

@permission_required('moderator')
def view_database(request):
    return render(request, 'account/database.html')


# =============================================================
# Database Management API Endpoints
# =============================================================

@permission_required('moderator')
@require_http_methods(["GET"])
def get_department_waste_data(request):
    """Get all department and waste type data for database management"""
    try:
        # Get all waste types
        waste_types = WasteType.objects.filter(is_active=True).order_by('name')
        waste_types_data = []
        
        for waste_type in waste_types:            
            waste_types_data.append({
                'id': waste_type.id,
                'name': waste_type.name,
                'unit': waste_type.unit,
                'unit_display': waste_type.get_unit_display_name()
            })
        
        # Get all departments
        departments = Department.objects.filter(is_active=True).order_by('display_order', 'name')
        departments_data = [{
            'id': dept.id,
            'name': dept.name,
            'display_order': dept.display_order
        } for dept in departments]
        
        return JsonResponse({
            'success': True,
            'data': {
                'waste_types': waste_types_data,
                'departments': departments_data
            }
        })
    except Exception as e:
        return handle_error(
            e,
            user_message="無法取得資料，請稍後再試",
            log_context={'user': request.user.username, 'action': 'get_department_waste_data'},
            status=500
        )


@permission_required('moderator')
@csrf_protect
@require_http_methods(["POST"])
def save_waste_type(request):
    """Create or update waste type"""
    try:
        data = json.loads(request.body)
        waste_type_id = data.get('id')
        name = data.get('name', '').strip()
        unit = data.get('unit', 'metric_ton')
        
        if not name:
            return JsonResponse({'success': False, 'error': '廢棄物種類名稱不能為空'})
        
        # Handle multiple names separated by semicolon
        names = [n.strip() for n in name.split(';') if n.strip()]
        created_count = 0
        updated_count = 0
        errors = []
        
        with transaction.atomic():
            if waste_type_id:
                # Update existing waste type
                try:
                    waste_type = WasteType.objects.get(id=waste_type_id)
                    if len(names) == 1:
                        waste_type.name = names[0]
                        waste_type.unit = unit
                        waste_type.save()
                        updated_count = 1
                    else:
                        return JsonResponse({'success': False, 'error': '編輯模式下不支援一次新增多個廢棄物種類'})
                except WasteType.DoesNotExist:
                    return JsonResponse({'success': False, 'error': '廢棄物種類不存在'})
            else:
                # Create new waste types
                for name_item in names:
                    try:
                        WasteType.objects.create(
                            name=name_item,
                            unit=unit
                        )
                        created_count += 1
                    except IntegrityError as e:
                        if 'UNIQUE constraint failed: waste_types.name' in str(e):
                            errors.append(f"廢棄物種類 '{name_item}' 已存在，請使用其他名稱")
                        else:
                            errors.append(f"無法建立廢棄物種類 '{name_item}': 資料庫完整性錯誤")
                    except Exception as e:
                        errors.append(f"無法建立 '{name_item}': {str(e)}")
        
        if errors:
            return JsonResponse({'success': False, 'error': '; '.join(errors)})
        
        message = []
        if created_count > 0:
            message.append(f"成功新增 {created_count} 個廢棄物種類")
        if updated_count > 0:
            message.append(f"成功更新 {updated_count} 個廢棄物種類")
            
        return JsonResponse({'success': True, 'message': '; '.join(message)})
        
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': '無效的 JSON 格式'})
    except Exception as e:
        logger.error(f"Error saving waste type: {e}")
        return JsonResponse({'success': False, 'error': str(e)})


@permission_required('moderator')
@csrf_protect
@require_http_methods(["POST"])
def delete_waste_types(request):
    """Delete waste types"""
    try:
        data = json.loads(request.body)
        waste_type_ids = data.get('ids', [])
        
        if not waste_type_ids:
            return JsonResponse({'success': False, 'error': '請選擇要刪除的廢棄物種類'})
        
        deleted_count = 0
        errors = []
        
        with transaction.atomic():
            for waste_type_id in waste_type_ids:
                try:
                    waste_type = WasteType.objects.get(id=waste_type_id)
                    
                    # Check if there are waste records using this waste type
                    from WasteManagement.models import WasteRecord
                    record_count = WasteRecord.objects.filter(waste_type=waste_type).count()
                    
                    if record_count > 0:
                        errors.append(f"'{waste_type.name}' 仍有 {record_count} 筆廢棄物記錄，無法刪除")
                        continue
                    
                    # Actually delete the record instead of soft delete
                    waste_type.delete()
                    deleted_count += 1
                    
                except WasteType.DoesNotExist:
                    errors.append(f"ID {waste_type_id} 的廢棄物種類不存在")
                except Exception as e:
                    errors.append(f"刪除失敗: {str(e)}")
        
        if errors:
            return JsonResponse({'success': False, 'error': '; '.join(errors)})
        
        return JsonResponse({'success': True, 'message': f"成功刪除 {deleted_count} 個廢棄物種類"})
        
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': '無效的 JSON 格式'})
    except Exception as e:
        logger.error(f"Error deleting waste types: {e}")
        return JsonResponse({'success': False, 'error': str(e)})


@permission_required('moderator')
@csrf_protect
@require_http_methods(["POST"])
def save_department(request):
    """Create or update department"""
    try:
        data = json.loads(request.body)
        department_id = data.get('id')
        name = data.get('name', '').strip()
        
        if not name:
            return JsonResponse({'success': False, 'error': '部門名稱不能為空'})
        
        # Handle multiple names separated by semicolon
        names = [n.strip() for n in name.split(';') if n.strip()]
        created_count = 0
        updated_count = 0
        reused_count = 0
        errors = []
        
        # Handle each department name individually to prevent transaction rollback
        for name_item in names:
            try:
                with transaction.atomic():
                    if department_id:
                        # Update existing department
                        try:
                            department = Department.objects.get(id=department_id)
                            if len(names) == 1:
                                department.name = name_item
                                department.save()
                                updated_count = 1
                            else:
                                errors.append('編輯模式下不支援一次更新多個部門')
                                continue
                        except Department.DoesNotExist:
                            errors.append('部門不存在')
                            continue
                    else:
                        # Try to get existing department or create new one
                        department, created = Department.objects.get_or_create(
                            name=name_item,
                            defaults={
                                'display_order': Department.objects.aggregate(
                                    max_order=models.Max('display_order')
                                )['max_order'] or 0 + 1
                            }
                        )
                        
                        if created:
                            created_count += 1
                        else:
                            reused_count += 1
                                
            except Exception as e:
                errors.append(f"處理部門 '{name_item}' 時發生錯誤: {str(e)}")
        
        # Build response message
        message_parts = []
        if created_count > 0:
            message_parts.append(f"新增 {created_count} 個部門")
        if updated_count > 0:
            message_parts.append(f"更新 {updated_count} 個部門")
        if reused_count > 0:
            message_parts.append(f"重用 {reused_count} 個現有部門")
        
        success_message = "成功" + "、".join(message_parts) if message_parts else ""
        
        if errors and not message_parts:
            # All operations failed
            return JsonResponse({'success': False, 'error': '; '.join(errors)})
        elif errors:
            # Some operations succeeded, some failed
            return JsonResponse({
                'success': True, 
                'message': success_message,
                'warnings': '; '.join(errors)
            })
        else:
            # All operations succeeded
            return JsonResponse({'success': True, 'message': success_message})
        
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': '無效的 JSON 格式'})
    except Exception as e:
        logger.error(f"Error saving department: {e}")
        return JsonResponse({'success': False, 'error': str(e)})


@permission_required('moderator')
@csrf_protect
@require_http_methods(["POST"])
def delete_departments(request):
    """Delete departments"""
    try:
        data = json.loads(request.body)
        department_ids = data.get('ids', [])
        
        if not department_ids:
            return JsonResponse({'success': False, 'error': '請選擇要刪除的部門'})
        
        deleted_count = 0
        errors = []
        
        with transaction.atomic():
            for department_id in department_ids:
                try:
                    # Check if there are waste records for this department
                    from WasteManagement.models import WasteRecord
                    record_count = WasteRecord.objects.filter(
                        department_id=department_id
                    ).count()
                    
                    if record_count > 0:
                        department = Department.objects.get(id=department_id)
                        errors.append(f"'{department.name}' 仍有 {record_count} 筆廢棄物記錄，無法刪除")
                        continue
                    
                    # Delete the department
                    department = Department.objects.get(id=department_id)
                    department.delete()
                    deleted_count += 1
                    
                except Department.DoesNotExist:
                    errors.append(f"部門不存在")
                except Exception as e:
                    errors.append(f"刪除失敗: {str(e)}")
        
        if errors and deleted_count == 0:
            return JsonResponse({'success': False, 'error': '; '.join(errors)})
        elif errors:
            return JsonResponse({
                'success': True,
                'message': f"成功刪除 {deleted_count} 個部門",
                'warnings': '; '.join(errors)
            })
        else:
            return JsonResponse({'success': True, 'message': f"成功刪除 {deleted_count} 個部門"})
        
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': '無效的 JSON 格式'})
    except Exception as e:
        logger.error(f"Error deleting departments: {e}")
        return JsonResponse({'success': False, 'error': str(e)})

