import json
import logging
import chardet
import csv
import io
import time
from datetime import datetime
from django.db import transaction, OperationalError
from django.db.models import Q, Count
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_protect
from django.core.paginator import Paginator

from MedicalWasteManagementSystem.permissions import *
from WasteTransportation.models import *
from django.views.decorators.csrf import ensure_csrf_cookie

logger = logging.getLogger(__name__)

# CSV field mapping for disposal manifests
DISPOSAL_FIELD_MAPPING = {
    '聯單編號': 'manifest_number',
    '事業機構代碼': 'enterprise_code',
    '事業機構名稱': 'enterprise_name',
    '申報日期': 'declaration_date',
    '申報時間': 'declaration_time',
    '清運日期': 'transportation_date',
    '清運時間': 'transportation_time',
    '清除者代碼': 'transporter_code',
    '清除者名稱': 'transporter_name',
    '運送日期': 'delivery_date',
    '運送時間': 'delivery_time',
    '運載車號': 'vehicle_number',
    '清除者運載車號': 'transport_vehicle_number',
    '處理者代碼': 'treatment_facility_code',
    '處理者名稱': 'treatment_facility_name',
    '收受日期': 'receipt_date',
    '收受時間': 'receipt_time',
    '中間處理方式': 'intermediate_treatment_method',
    '處理完成日期': 'treatment_completion_date',
    '處理完成時間': 'treatment_completion_time',
    '最終處置方式': 'final_disposal_method',
    '處理者運載車號': 'treatment_vehicle_number',
    '廢棄物代碼': 'waste_substance_code',
    '廢棄物名稱': 'waste_substance_name',
    '申報重量': 'declared_weight',
    '製程代碼': 'process_code',
    '製程名稱': 'process_name',
    '廢棄物ID': 'waste_substance_id',
}

# CSV field mapping for reuse manifests
REUSE_FIELD_MAPPING = {
    '聯單編號': 'manifest_number',
    '事業機構代碼': 'enterprise_code',
    '事業機構名稱': 'enterprise_name',
    '申報日期': 'declaration_date',
    '申報時間': 'declaration_time',
    '清運日期': 'transportation_date',
    '清運時間': 'transportation_time',
    '再利用用途': 'recycling_purpose',
    '再利用用途說明': 'recycling_purpose_description',
    '再利用方式': 'recycling_method',
    '清除者代碼': 'transporter_code',
    '清除者名稱': 'transporter_name',
    '其它清除者': 'other_transporters',
    '運送日期': 'delivery_date',
    '運送時間': 'delivery_time',
    '運載車號': 'vehicle_number',
    '清除者實際運載車號': 'transport_vehicle_number',
    '再利用者代碼': 'recycler_code',
    '再利用者名稱': 'recycler_name',
    '再利用者性質': 'recycler_type',
    '回收日期': 'recovery_date',
    '回收時間': 'recovery_time',
    '再利用完成時間': 'recycling_completion_time',
    '物質代碼': 'waste_substance_code',
    '物質名稱': 'waste_substance_name',
    '申報重量': 'declared_weight',
    '製程代碼': 'process_code',
    '製程名稱': 'process_name',
    '再利用者實際運載車號': 'actual_recycler_vehicle_number',
    '廢棄物ID': 'waste_substance_id',
}


def detect_encoding(file_content):
    """Detect file encoding (UTF-8 or Big5)"""
    detected = chardet.detect(file_content)
    encoding = detected['encoding']

    if encoding and 'utf' in encoding.lower():
        return 'utf-8'
    elif encoding and 'big5' in encoding.lower():
        return 'big5'
    else:
        try:
            file_content.decode('utf-8')
            return 'utf-8'
        except UnicodeDecodeError:
            return 'big5'


def parse_datetime(date_str, time_str=None):
    """Parse date and time strings to datetime object"""
    from django.utils import timezone

    if not date_str or date_str.strip() == '':
        return timezone.now()

    try:
        date_str = date_str.strip()

        # Handle Chinese AM/PM format
        if '上午' in date_str or '下午' in date_str:
            parts = date_str.split(' ')
            if len(parts) >= 3:
                date_part = parts[0]
                am_pm = parts[1]
                time_part = parts[2]

                if '/' in date_part:
                    date_obj = datetime.strptime(date_part, '%Y/%m/%d').date()
                else:
                    date_obj = datetime.strptime(date_part, '%Y-%m-%d').date()

                time_obj = datetime.strptime(time_part, '%H:%M:%S').time()
                if am_pm == '下午' and time_obj.hour < 12:
                    time_obj = time_obj.replace(hour=time_obj.hour + 12)
                elif am_pm == '上午' and time_obj.hour == 12:
                    time_obj = time_obj.replace(hour=0)

                dt = datetime.combine(date_obj, time_obj)
                return timezone.make_aware(dt)

        # Handle regular formats
        try:
            dt = datetime.strptime(date_str, '%Y/%m/%d %H:%M:%S')
            return timezone.make_aware(dt)
        except ValueError:
            try:
                dt = datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S')
                return timezone.make_aware(dt)
            except ValueError:
                if '/' in date_str:
                    date_part = datetime.strptime(date_str, '%Y/%m/%d').date()
                else:
                    date_part = datetime.strptime(date_str, '%Y-%m-%d').date()

                dt = datetime.combine(date_part, datetime.min.time().replace(hour=12))
                return timezone.make_aware(dt)

    except ValueError as e:
        logger.warning(f"Failed to parse datetime: {date_str}, error: {e}")
        return timezone.now()


def apply_filters_to_queryset(queryset, filters):
    """Apply filters to queryset based on filter criteria"""
    for filter_item in filters:
        category = filter_item.get('category')
        sub_category = filter_item.get('subCategory')
        value = filter_item.get('value')

        if not value:
            continue

        # Map filter fields to model fields with correct relationships
        field_mapping = {
            'manifestNumber': 'manifest_number',
            'manifestTypeDisplay': 'manifest_type_display',
            'vehicleNumber': 'vehicle_number',
            'wasteSubstanceName': 'waste_substance_id__waste_substance_code__waste_substance_name',
            'enterpriseCode': 'declaration__enterprise__enterprise_code',
            'enterpriseName': 'declaration__enterprise__enterprise_name',
            'declarationDatetime': 'declaration__declaration_datetime',
            'declaredWeight': 'declaration__declared_weight',
            'wasteCode': 'waste_substance_id__waste_substance_code__waste_substance_code',
            'wasteName': 'waste_substance_id__waste_substance_code__waste_substance_name',
            'substanceCode': 'waste_substance_id__waste_substance_code__waste_substance_code',
            'substanceName': 'waste_substance_id__waste_substance_code__waste_substance_name',
            'processCode': 'waste_substance_id__process__process_code',
            'processName': 'waste_substance_id__process__process_name',
            'transporterCode': 'transportation__transporter__transporter_code',
            'transporterName': 'transportation__transporter__transporter_name',
            'transportVehicleNumber': 'transportation__transport_vehicle__transport_vehicle_number',
            'transportationDatetime': 'transportation__transportation_datetime',
            'deliveryDatetime': 'transportation__delivery_datetime',
            # Treatment info fields
            'treatmentFacilityCode': 'treatment__treatment_facility__treatment_facility_code',
            'treatmentFacilityName': 'treatment__treatment_facility__treatment_facility_name',
            'receiptDatetime': 'treatment__receipt_datetime',
            'intermediateTreatmentMethod': 'treatment__intermediate_treatment_method',
            'finalDisposalMethod': 'treatment__final_disposal_method',
            # Recovery info fields
            'recyclerCode': 'recovery__recycler__recycler_code',
            'recyclerName': 'recovery__recycler__recycler_name',
            'recoveryDatetime': 'recovery__recovery_datetime',
            'recyclingPurpose': 'recovery__recycler__recycling_purpose',
            'recyclingMethod': 'recovery__recycler__recycling_method',
        }

        db_field = field_mapping.get(sub_category)
        if not db_field:
            continue

        try:
            if isinstance(value, str):
                # String filter - use case-insensitive contains
                filter_kwargs = {f"{db_field}__icontains": value}
                queryset = queryset.filter(**filter_kwargs)
            elif isinstance(value, dict):
                if 'start' in value or 'end' in value:
                    # DateTime range filter
                    start = value.get('start')
                    end = value.get('end')
                    if start:
                        filter_kwargs = {f"{db_field}__gte": start}
                        queryset = queryset.filter(**filter_kwargs)
                    if end:
                        filter_kwargs = {f"{db_field}__lte": end}
                        queryset = queryset.filter(**filter_kwargs)
                elif 'min' in value or 'max' in value:
                    # Number range filter
                    min_val = value.get('min')
                    max_val = value.get('max')
                    if min_val and min_val != '':
                        try:
                            min_float = float(min_val)
                            filter_kwargs = {f"{db_field}__gte": min_float}
                            queryset = queryset.filter(**filter_kwargs)
                        except (ValueError, TypeError):
                            continue
                    if max_val and max_val != '':
                        try:
                            max_float = float(max_val)
                            filter_kwargs = {f"{db_field}__lte": max_float}
                            queryset = queryset.filter(**filter_kwargs)
                        except (ValueError, TypeError):
                            continue
        except Exception as e:
            logger.warning(f"Filter error for field {db_field}: {e}")
            continue

    return queryset


@ensure_csrf_cookie
@permission_required("importer")
def transportation_index(request):
    """Main transportation management page"""
    # Show counts for overall category without filters initially
    total_count = Manifest.objects.count()
    disposal_count = Manifest.objects.filter(treatment__isnull=False).count()
    reuse_count = Manifest.objects.filter(recovery__isnull=False).count()

    context = {
        'total_count': total_count,
        'disposal_count': disposal_count,
        'reuse_count': reuse_count,
    }

    return render(request, 'transportation/transportation.html', context)


@permission_required("importer")
@csrf_protect
def get_statistics(request):
    """Get manifest statistics with filter support"""
    if request.method not in ['GET', 'POST']:
        return JsonResponse({'success': False, 'error': '無效請求'})

    try:
        # Get filters from request
        filters = []
        category = 'overall'

        if request.method == 'POST':
            data = json.loads(request.body.decode('utf-8'))
            filters = data.get('filters', [])
            category = data.get('category', 'overall')

        # Start with base queryset
        queryset = Manifest.objects.all()

        # Always apply filters to get counts for current filter criteria
        if filters:
            queryset = apply_filters_to_queryset(queryset, filters)

        # Apply category filter if specified
        if category == 'disposal':
            queryset = queryset.filter(treatment__isnull=False)
        elif category == 'reuse':
            queryset = queryset.filter(recovery__isnull=False)

        # Calculate filtered counts that reflect current filter state
        if filters:
            # When filters are applied, show counts for the filtered dataset
            if category == 'overall':
                # For overall with filters, show total filtered count and breakdown
                total_count = queryset.count()
                disposal_count = queryset.filter(treatment__isnull=False).count()
                reuse_count = queryset.filter(recovery__isnull=False).count()
            elif category == 'disposal':
                # For disposal category with filters
                disposal_count = queryset.count()
                # Show total from filtered base queryset (without category filter)
                base_filtered = Manifest.objects.all()
                base_filtered = apply_filters_to_queryset(base_filtered, filters)
                total_count = base_filtered.count()
                reuse_count = base_filtered.filter(recovery__isnull=False).count()
            elif category == 'reuse':
                # For reuse category with filters
                reuse_count = queryset.count()
                # Show total from filtered base queryset (without category filter)
                base_filtered = Manifest.objects.all()
                base_filtered = apply_filters_to_queryset(base_filtered, filters)
                total_count = base_filtered.count()
                disposal_count = base_filtered.filter(treatment__isnull=False).count()
        else:
            # No filters - show all counts
            if category == 'overall':
                total_count = queryset.count()
                disposal_count = queryset.filter(treatment__isnull=False).count()
                reuse_count = queryset.filter(recovery__isnull=False).count()
            elif category == 'disposal':
                disposal_count = queryset.count()
                total_count = Manifest.objects.count()
                reuse_count = Manifest.objects.filter(recovery__isnull=False).count()
            elif category == 'reuse':
                reuse_count = queryset.count()
                total_count = Manifest.objects.count()
                disposal_count = Manifest.objects.filter(treatment__isnull=False).count()

        return JsonResponse({
            'success': True,
            'totalCount': total_count,
            'disposalCount': disposal_count,
            'reuseCount': reuse_count,
        })
    except Exception as e:
        logger.error(f"Get statistics error: {str(e)}", exc_info=True)
        return JsonResponse({'success': False, 'error': f'伺服器錯誤: {str(e)}'})


@permission_required("importer")
@csrf_protect
def get_manifests(request):
    """Get manifest list with pagination and filtering"""
    if request.method not in ['GET', 'POST']:
        return JsonResponse({'success': False, 'error': '無效請求'})

    try:
        # Handle both GET and POST requests
        if request.method == 'GET':
            manifest_type = request.GET.get('type', 'overall')
            page = int(request.GET.get('page', 1))
            filters = []
        else:  # POST
            data = json.loads(request.body.decode('utf-8'))
            manifest_type = data.get('category', 'overall')
            page = int(data.get('page', 1))
            filters = data.get('filters', [])

        page_size = 300  # Keep original page size

        # Validate page number to prevent negative or zero page requests
        if page < 1:
            page = 1

        logger.info(f"get_manifests called: category={manifest_type}, page={page}, filters_count={len(filters)}")

        # Start with base queryset with proper select_related for performance
        queryset = Manifest.objects.all().select_related(
            'declaration__enterprise',
            'waste_substance_id__waste_substance_code',
            'waste_substance_id__process',
            'transportation__transporter',
            'transportation__transport_vehicle',
            'treatment__treatment_facility',
            'recovery__recycler'
        ).order_by('manifest_number', 'waste_substance_id')

        # Apply category filter
        if manifest_type == 'disposal':
            queryset = queryset.filter(treatment__isnull=False)
        elif manifest_type == 'reuse':
            queryset = queryset.filter(recovery__isnull=False)

        # Apply filters if provided
        if filters:
            queryset = apply_filters_to_queryset(queryset, filters)

        # Get total count before pagination
        total_count = queryset.count()
        logger.info(f"Total matching manifests: {total_count}")

        # Apply pagination
        paginator = Paginator(queryset, page_size)

        # Handle page out of range gracefully
        try:
            manifests_page = paginator.get_page(page)
        except Exception as e:
            logger.warning(f"Pagination error for page {page}: {e}")
            # Return empty page if requested page is out of range
            return JsonResponse({
                'success': True,
                'manifests': [],
                'hasNext': False,
                'hasPrevious': False,
                'currentPage': page,
                'totalPages': paginator.num_pages,
                'totalCount': total_count,
            })

        # Log pagination state for debugging
        logger.info(f"Page {page}/{paginator.num_pages}: returning {len(manifests_page)} manifests")
        logger.info(f"hasNext: {manifests_page.has_next()}, hasPrevious: {manifests_page.has_previous()}")

        manifest_list = []
        for manifest in manifests_page:
            manifest_data = {
                'manifestNumber': manifest.manifest_number,
                'wasteSubstanceId': manifest.waste_substance_id.waste_substance_id,
                'manifestType': manifest.manifest_type,
                'manifestTypeDisplay': manifest.manifest_type_display,
                'wasteSubstanceName': manifest.waste_substance_id.waste_substance_code.waste_substance_name,
                'vehicleNumber': manifest.vehicle_number,
                'enterpriseCode': manifest.declaration.enterprise.enterprise_code,
                'enterpriseName': manifest.declaration.enterprise.enterprise_name,
                'declaredWeight': float(
                    manifest.declaration.declared_weight) if manifest.declaration.declared_weight else 0,
            }
            manifest_list.append(manifest_data)

        # Response with pagination info
        response_data = {
            'success': True,
            'manifests': manifest_list,
            'hasNext': manifests_page.has_next(),
            'hasPrevious': manifests_page.has_previous(),
            'currentPage': manifests_page.number,  # Use actual page number from paginator
            'totalPages': paginator.num_pages,
            'totalCount': total_count,
            'pageSize': page_size,
            'startIndex': (manifests_page.number - 1) * page_size + 1,
            'endIndex': (manifests_page.number - 1) * page_size + len(manifest_list)
        }

        logger.info(
            f"Response: page={response_data['currentPage']}, hasNext={response_data['hasNext']}, count={len(manifest_list)}")

        return JsonResponse(response_data)

    except json.JSONDecodeError:
        logger.error("JSON decode error in get_manifests")
        return JsonResponse({'success': False, 'error': '無效的 JSON 數據'})
    except ValueError as e:
        logger.error(f"Value error in get_manifests: {str(e)}")
        return JsonResponse({'success': False, 'error': f'參數錯誤: {str(e)}'})
    except Exception as e:
        logger.error(f"Get manifests error: {str(e)}", exc_info=True)
        return JsonResponse({'success': False, 'error': f'伺服器錯誤: {str(e)}'})


@permission_required("importer")
@csrf_protect
def get_manifest_detail(request):
    """Get detailed manifest information"""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'error': '無效請求'})

    manifest_number = request.GET.get('manifestNumber')
    waste_substance_id = request.GET.get('wasteSubstanceId')

    if not manifest_number or not waste_substance_id:
        return JsonResponse({'success': False, 'error': '缺少必要參數'})

    try:
        manifest = Manifest.objects.select_related(
            'declaration__enterprise',
            'waste_substance_id__waste_substance_code',
            'waste_substance_id__process',
            'transportation__transporter',
            'transportation__transport_vehicle',
            'treatment__treatment_facility',
            'treatment__treatment_vehicle',
            'recovery__recycler',
            'recovery__recovery_vehicle'
        ).get(
            manifest_number=manifest_number,
            waste_substance_id=waste_substance_id
        )

        detail = {
            'manifestNumber': manifest.manifest_number,
            'manifestType': manifest.manifest_type_display,
            'vehicleNumber': manifest.vehicle_number,
            'declarationDatetime': manifest.declaration.declaration_datetime.strftime('%Y/%m/%d %H:%M:%S'),
            'declaredWeight': manifest.declaration.declared_weight,
            'enterpriseCode': manifest.declaration.enterprise.enterprise_code,
            'enterpriseName': manifest.declaration.enterprise.enterprise_name,
            'transportationDatetime': manifest.transportation.transportation_datetime.strftime('%Y/%m/%d %H:%M:%S'),
            'deliveryDatetime': manifest.transportation.delivery_datetime.strftime('%Y/%m/%d %H:%M:%S'),
            'transporterCode': manifest.transportation.transporter.transporter_code,
            'transporterName': manifest.transportation.transporter.transporter_name,
            'transportVehicleNumber': manifest.transportation.transport_vehicle.transport_vehicle_number,
        }

        if manifest.manifest_type == 'disposal':
            detail.update({
                'wasteCode': manifest.waste_substance_id.waste_substance_code.waste_substance_code,
                'wasteName': manifest.waste_substance_id.waste_substance_code.waste_substance_name,
                'processCode': manifest.waste_substance_id.process.process_code,
                'processName': manifest.waste_substance_id.process.process_name,
            })

            if manifest.treatment:
                detail.update({
                    'receiptDatetime': manifest.treatment.receipt_datetime.strftime('%Y/%m/%d %H:%M:%S'),
                    'treatmentCompletionDatetime': manifest.treatment.treatment_completion_datetime.strftime(
                        '%Y/%m/%d %H:%M:%S') if manifest.treatment.treatment_completion_datetime else '',
                    'treatmentFacilityCode': manifest.treatment.treatment_facility.treatment_facility_code,
                    'treatmentFacilityName': manifest.treatment.treatment_facility.treatment_facility_name,
                    'intermediateTreatmentMethod': manifest.treatment.intermediate_treatment_method,
                    'finalDisposalMethod': manifest.treatment.final_disposal_method,
                    'treatmentVehicleNumber': manifest.treatment.treatment_vehicle.treatment_vehicle_number,
                })

        elif manifest.manifest_type == 'reuse':
            detail.update({
                'substanceCode': manifest.waste_substance_id.waste_substance_code.waste_substance_code,
                'substanceName': manifest.waste_substance_id.waste_substance_code.waste_substance_name,
                'processCode': manifest.waste_substance_id.process.process_code,
                'processName': manifest.waste_substance_id.process.process_name,
            })

            if manifest.recovery:
                detail.update({
                    'recoveryDatetime': manifest.recovery.recovery_datetime.strftime('%Y/%m/%d %H:%M:%S'),
                    'recyclingCompletionDatetime': manifest.recovery.recycler.recycling_completion_datetime.strftime(
                        '%Y/%m/%d %H:%M:%S') if manifest.recovery.recycler.recycling_completion_datetime else '',
                    'recyclerCode': manifest.recovery.recycler.recycler_code,
                    'recyclerName': manifest.recovery.recycler.recycler_name,
                    'recyclingPurpose': manifest.recovery.recycler.recycling_purpose or '',
                    'recyclingMethod': manifest.recovery.recycler.recycling_method or '',
                    'recoveryVehicleNumber': manifest.recovery.recovery_vehicle.recovery_vehicle_number,
                    'actualRecyclerVehicleNumber': manifest.recovery.recycler.actual_recycler_vehicle_number or '',
                })

        return JsonResponse({'success': True, 'detail': detail})

    except Manifest.DoesNotExist:
        return JsonResponse({'success': False, 'error': '聯單不存在'})
    except Exception as e:
        logger.error(f"Get manifest detail error: {str(e)}", exc_info=True)
        return JsonResponse({'success': False, 'error': f'伺服器錯誤: {str(e)}'})


@permission_required("importer")
@csrf_protect
def get_existing_manifest_data(request):
    """Get existing manifest data for conflict resolution"""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'error': '無效請求'})

    manifest_number = request.GET.get('manifestNumber')
    process_code = request.GET.get('processCode')

    if not manifest_number:
        return JsonResponse({'success': False, 'error': '缺少聯單編號'})

    try:
        queryset = Manifest.objects.select_related(
            'declaration__enterprise',
            'waste_substance_id__waste_substance_code',
            'waste_substance_id__process',
            'transportation__transporter',
            'transportation__transport_vehicle',
            'treatment__treatment_facility',
            'treatment__treatment_vehicle',
            'recovery__recycler',
            'recovery__recovery_vehicle'
        ).filter(
            manifest_number=manifest_number
            # Remove is_visible filter to show all manifests including hidden ones for conflict detection
        )

        # If process_code is provided, filter by it to get the exact matching manifest
        if process_code:
            queryset = queryset.filter(waste_substance_id__process__process_code=process_code)

        manifest = queryset.first()

        if not manifest:
            return JsonResponse({'success': False, 'error': '聯單不存在'})

        manifest_data = {
            'manifestNumber': manifest.manifest_number,
            'manifestTypeDisplay': manifest.manifest_type_display,
            'vehicleNumber': manifest.vehicle_number,
            'enterpriseCode': manifest.declaration.enterprise.enterprise_code,
            'enterpriseName': manifest.declaration.enterprise.enterprise_name,
            'declaredWeight': str(manifest.declaration.declared_weight),
            'transporterCode': manifest.transportation.transporter.transporter_code,
            'transporterName': manifest.transportation.transporter.transporter_name,
            'processCode': manifest.waste_substance_id.process.process_code,
            'processName': manifest.waste_substance_id.process.process_name,
        }

        if manifest.manifest_type == 'disposal':
            manifest_data.update({
                'wasteCode': manifest.waste_substance_id.waste_substance_code.waste_substance_code,
                'wasteName': manifest.waste_substance_id.waste_substance_code.waste_substance_name,
            })
            if manifest.treatment:
                manifest_data.update({
                    'treatmentFacilityCode': manifest.treatment.treatment_facility.treatment_facility_code,
                    'treatmentFacilityName': manifest.treatment.treatment_facility.treatment_facility_name,
                    'intermediateTreatmentMethod': manifest.treatment.intermediate_treatment_method,
                    'finalDisposalMethod': manifest.treatment.final_disposal_method,
                })
        elif manifest.manifest_type == 'reuse':
            manifest_data.update({
                'substanceCode': manifest.waste_substance_id.waste_substance_code.waste_substance_code,
                'substanceName': manifest.waste_substance_id.waste_substance_code.waste_substance_name,
            })
            if manifest.recovery:
                manifest_data.update({
                    'recyclerCode': manifest.recovery.recycler.recycler_code,
                    'recyclerName': manifest.recovery.recycler.recycler_name,
                    'recyclingPurpose': manifest.recovery.recycler.recycling_purpose or '',
                    'recyclingMethod': manifest.recovery.recycler.recycling_method or '',
                })

        return JsonResponse({'success': True, 'manifestData': manifest_data})

    except Exception as e:
        logger.error(f"Get existing manifest data error: {str(e)}", exc_info=True)
        return JsonResponse({'success': False, 'error': f'伺服器錯誤: {str(e)}'})


@permission_required("importer")
@csrf_protect
def get_matching_count(request):
    """Get count of manifests matching filter criteria"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': '無效請求'})

    try:
        data = json.loads(request.body.decode('utf-8'))
        category = data.get('category', 'overall')
        filters = data.get('filters', [])
        selected_only = data.get('selectedOnly', False)
        selected_manifests = data.get('selectedManifests', [])

        # Start with base queryset
        queryset = Manifest.objects.all()

        # Apply category filter
        if category == 'disposal':
            queryset = queryset.filter(treatment__isnull=False)
        elif category == 'reuse':
            queryset = queryset.filter(recovery__isnull=False)

        # Apply filters
        if filters:
            queryset = apply_filters_to_queryset(queryset, filters)

        total_matching = queryset.count()

        if selected_only:
            # Count how many of the selected manifests match the criteria by manifest key
            selected_keys = set(selected_manifests)
            matching_selected = 0

            for manifest in queryset:
                manifest_key = f"{manifest.manifest_number}-{manifest.waste_substance_id.waste_substance_id}"
                if manifest_key in selected_keys:
                    matching_selected += 1

            return JsonResponse({
                'success': True,
                'totalMatching': total_matching,
                'selectedCount': matching_selected
            })
        else:
            # Count how many of the matching manifests are in the selected list by manifest key
            selected_keys = set(selected_manifests)
            selected_count = 0

            for manifest in queryset:
                manifest_key = f"{manifest.manifest_number}-{manifest.waste_substance_id.waste_substance_id}"
                if manifest_key in selected_keys:
                    selected_count += 1

            return JsonResponse({
                'success': True,
                'totalMatching': total_matching,
                'selectedCount': selected_count
            })

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': '無效的 JSON 數據'})
    except Exception as e:
        logger.error(f"Get matching count error: {str(e)}", exc_info=True)
        return JsonResponse({'success': False, 'error': f'伺服器錯誤: {str(e)}'})


@permission_required("importer")
@csrf_protect
def get_matching_manifests(request):
    """Get manifest details matching filter criteria for bulk selection"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': '無效請求'})

    try:
        data = json.loads(request.body.decode('utf-8'))
        category = data.get('category', 'overall')
        filters = data.get('filters', [])
        action = data.get('action', 'select_all')

        # Start with base queryset with proper select_related for performance
        queryset = Manifest.objects.all().select_related(
            'declaration__enterprise',
            'waste_substance_id__waste_substance_code',
            'waste_substance_id__process',
            'transportation__transporter',
            'transportation__transport_vehicle',
            'treatment__treatment_facility',
            'recovery__recycler'
        )

        # Apply category filter
        if category == 'disposal':
            queryset = queryset.filter(treatment__isnull=False)
        elif category == 'reuse':
            queryset = queryset.filter(recovery__isnull=False)

        # Apply filters
        if filters:
            queryset = apply_filters_to_queryset(queryset, filters)

        # Get manifest details instead of just manifest numbers
        manifest_details = []
        for manifest in queryset:
            manifest_details.append({
                'manifestNumber': manifest.manifest_number,
                'wasteSubstanceId': manifest.waste_substance_id.waste_substance_id,
                'manifestType': manifest.manifest_type,
                'manifestTypeDisplay': manifest.manifest_type_display,
                'wasteSubstanceName': manifest.waste_substance_id.waste_substance_code.waste_substance_name,
                'vehicleNumber': manifest.vehicle_number,
                'enterpriseCode': manifest.declaration.enterprise.enterprise_code,
                'enterpriseName': manifest.declaration.enterprise.enterprise_name,
                'declaredWeight': float(
                    manifest.declaration.declared_weight) if manifest.declaration.declared_weight else 0,
            })

        return JsonResponse({
            'success': True,
            'manifestDetails': manifest_details,
            'count': len(manifest_details)
        })

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': '無效的 JSON 數據'})
    except Exception as e:
        logger.error(f"Get matching manifests error: {str(e)}", exc_info=True)
        return JsonResponse({'success': False, 'error': f'伺服器錯誤: {str(e)}'})


@permission_required("importer")
@csrf_protect
def bulk_remove(request):
    """RESTORED: Bulk hide manifests by setting is_visible=False (覆寫功能)"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': '無效請求'})

    try:
        data = json.loads(request.body.decode('utf-8'))
        category = data.get('category', 'overall')
        filters = data.get('filters', [])
        selected_manifest_keys = data.get('selectedManifestKeys', [])

        if not selected_manifest_keys:
            return JsonResponse({'success': False, 'error': '未選擇任何聯單'})

        # Parse manifest keys to get manifest_number and waste_substance_id pairs
        manifest_criteria = []
        for key in selected_manifest_keys:
            try:
                manifest_number, waste_substance_id = key.split('-', 1)
                manifest_criteria.append({
                    'manifest_number': manifest_number,
                    'waste_substance_id': int(waste_substance_id)
                })
            except (ValueError, IndexError):
                logger.warning(f"Invalid manifest key format: {key}")
                continue

        if not manifest_criteria:
            return JsonResponse({'success': False, 'error': '無效的聯單選擇格式'})

        # Process in batches to avoid expression tree depth limit
        batch_size = 100  # Process 100 items at a time to avoid SQL expression tree limit
        removed_count = 0

        with transaction.atomic():
            for i in range(0, len(manifest_criteria), batch_size):
                batch = manifest_criteria[i:i + batch_size]

                # Build Q objects for current batch
                from django.db.models import Q
                q_objects = Q()
                for criteria in batch:
                    q_objects |= Q(
                        manifest_number=criteria['manifest_number'],
                        waste_substance_id=criteria['waste_substance_id']
                    )

                # Delete manifests from database permanently
                manifests_to_delete = Manifest.objects.filter(q_objects)
                batch_removed = manifests_to_delete.count()
                manifests_to_delete.delete()

                removed_count += batch_removed

        return JsonResponse({
            'success': True,
            'removedCount': removed_count
        })

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': '無效的 JSON 數據'})
    except Exception as e:
        logger.error(f"Bulk remove error: {str(e)}", exc_info=True)
        return JsonResponse({'success': False, 'error': f'伺服器錯誤: {str(e)}'})


@permission_required("importer")
@csrf_protect
def bulk_remove_specific(request):
    """RESTORED: Bulk hide specific manifests by setting is_visible=False (覆寫功能)"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': '無效請求'})

    try:
        data = json.loads(request.body.decode('utf-8'))
        manifest_details = data.get('manifestDetails', [])

        if not manifest_details:
            return JsonResponse({'success': False, 'error': '未選擇任何聯單'})

        # Delete manifests from database permanently
        removed_count = 0
        with transaction.atomic():
            for detail in manifest_details:
                manifest_number = detail.get('manifestNumber')
                waste_substance_id = detail.get('wasteSubstanceId')

                if manifest_number and waste_substance_id:
                    manifests_to_delete = Manifest.objects.filter(
                        manifest_number=manifest_number,
                        waste_substance_id=waste_substance_id
                    )
                    count = manifests_to_delete.count()
                    manifests_to_delete.delete()
                    removed_count += count

        return JsonResponse({
            'success': True,
            'removedCount': removed_count
        })

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': '無效的 JSON 數據'})
    except Exception as e:
        logger.error(f"Bulk remove specific error: {str(e)}", exc_info=True)
        return JsonResponse({'success': False, 'error': f'伺服器錯誤: {str(e)}'})


@permission_required("importer")
@csrf_protect
def get_filtered_field_options(request):
    """Get field options based on current filters and category"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': '無效請求'})

    try:
        data = json.loads(request.body.decode('utf-8'))
        category = data.get('category')
        field = data.get('field')
        filters = data.get('filters', [])

        if not category or not field:
            return JsonResponse({'success': False, 'error': '缺少參數'})

        # Map field names to model fields with proper relationships including treatment/recovery
        field_mapping = {
            'manifestNumber': 'manifest_number',
            'manifestTypeDisplay': 'manifest_type_display',
            'vehicleNumber': 'vehicle_number',
            'enterpriseCode': 'declaration__enterprise__enterprise_code',
            'enterpriseName': 'declaration__enterprise__enterprise_name',
            'declarationDatetime': 'declaration__declaration_datetime',
            'transporterCode': 'transportation__transporter__transporter_code',
            'transporterName': 'transportation__transporter__transporter_name',
            'wasteCode': 'waste_substance_id__waste_substance_code__waste_substance_code',
            'wasteName': 'waste_substance_id__waste_substance_code__waste_substance_name',
            'substanceCode': 'waste_substance_id__waste_substance_code__waste_substance_code',
            'substanceName': 'waste_substance_id__waste_substance_code__waste_substance_name',
            'processCode': 'waste_substance_id__process__process_code',
            'processName': 'waste_substance_id__process__process_name',
            'wasteSubstanceName': 'waste_substance_id__waste_substance_code__waste_substance_name',
            # Treatment info fields
            'treatmentFacilityCode': 'treatment__treatment_facility__treatment_facility_code',
            'treatmentFacilityName': 'treatment__treatment_facility__treatment_facility_name',
            'intermediateTreatmentMethod': 'treatment__intermediate_treatment_method',
            'finalDisposalMethod': 'treatment__final_disposal_method',
            # Recovery info fields
            'recyclerCode': 'recovery__recycler__recycler_code',
            'recyclerName': 'recovery__recycler__recycler_name',
            'recyclingPurpose': 'recovery__recycler__recycling_purpose',
            'recyclingMethod': 'recovery__recycler__recycling_method',
        }

        db_field = field_mapping.get(field)
        if not db_field:
            return JsonResponse({'success': False, 'error': '無效欄位'})

        # Start with base queryset with extended select_related for treatment/recovery
        queryset = Manifest.objects.all().select_related(
            'declaration__enterprise',
            'waste_substance_id__waste_substance_code',
            'waste_substance_id__process',
            'transportation__transporter',
            'treatment__treatment_facility',
            'recovery__recycler'
        )

        # Apply category filter
        if category == 'disposal':
            queryset = queryset.filter(treatment__isnull=False)
        elif category == 'reuse':
            queryset = queryset.filter(recovery__isnull=False)

        # Apply existing filters (excluding the current field being filtered)
        if filters:
            queryset = apply_filters_to_queryset(queryset, filters)

        # Get unique values with proper select_related for performance
        values = queryset.values_list(db_field, flat=True).exclude(
            **{f"{db_field}__isnull": True}
        ).exclude(
            **{f"{db_field}__exact": ''}
        ).distinct()

        # Convert to list and limit results
        options = [str(v) for v in values if v is not None][:500]  # Increased limit to 500 options

        return JsonResponse({'success': True, 'options': sorted(set(options))})

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': '無效的 JSON 數據'})
    except Exception as e:
        logger.error(f"Get filtered field options error: {str(e)}", exc_info=True)
        return JsonResponse({'success': False, 'error': f'伺服器錯誤: {str(e)}'})


@permission_required("importer")
@csrf_protect
def get_field_options(request):
    """Get unique field values for filtering with better performance"""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'error': '無效請求'})

    category = request.GET.get('category')
    field = request.GET.get('field')

    if not category or not field:
        return JsonResponse({'success': False, 'error': '缺少參數'})

    try:
        # Map field names to model fields with proper relationships including treatment/recovery
        field_mapping = {
            'manifestNumber': 'manifest_number',
            'manifestTypeDisplay': 'manifest_type_display',
            'vehicleNumber': 'vehicle_number',
            'enterpriseCode': 'declaration__enterprise__enterprise_code',
            'enterpriseName': 'declaration__enterprise__enterprise_name',
            'declarationDatetime': 'declaration__declaration_datetime',
            'transporterCode': 'transportation__transporter__transporter_code',
            'transporterName': 'transportation__transporter__transporter_name',
            'wasteCode': 'waste_substance_id__waste_substance_code__waste_substance_code',
            'wasteName': 'waste_substance_id__waste_substance_code__waste_substance_name',
            'substanceCode': 'waste_substance_id__waste_substance_code__waste_substance_code',
            'substanceName': 'waste_substance_id__waste_substance_code__waste_substance_name',
            'processCode': 'waste_substance_id__process__process_code',
            'processName': 'waste_substance_id__process__process_name',
            'wasteSubstanceName': 'waste_substance_id__waste_substance_code__waste_substance_name',
            # Treatment info fields
            'treatmentFacilityCode': 'treatment__treatment_facility__treatment_facility_code',
            'treatmentFacilityName': 'treatment__treatment_facility__treatment_facility_name',
            'intermediateTreatmentMethod': 'treatment__intermediate_treatment_method',
            'finalDisposalMethod': 'treatment__final_disposal_method',
            # Recovery info fields
            'recyclerCode': 'recovery__recycler__recycler_code',
            'recyclerName': 'recovery__recycler__recycler_name',
            'recyclingPurpose': 'recovery__recycler__recycling_purpose',
            'recyclingMethod': 'recovery__recycler__recycling_method',
        }

        db_field = field_mapping.get(field)
        if not db_field:
            return JsonResponse({'success': False, 'error': '無效欄位'})

        # Get unique values with proper select_related for performance including treatment/recovery
        queryset = Manifest.objects.all().select_related(
            'declaration__enterprise',
            'waste_substance_id__waste_substance_code',
            'waste_substance_id__process',
            'transportation__transporter',
            'treatment__treatment_facility',
            'recovery__recycler'
        )

        # Get unique non-null values
        values = queryset.values_list(db_field, flat=True).exclude(
            **{f"{db_field}__isnull": True}
        ).exclude(
            **{f"{db_field}__exact": ''}
        ).distinct()

        # Convert to list and limit results
        options = [str(v) for v in values if v is not None][:100]  # Limit to 100 options

        return JsonResponse({'success': True, 'options': sorted(set(options))})

    except Exception as e:
        logger.error(f"Get field options error: {str(e)}", exc_info=True)
        return JsonResponse({'success': False, 'error': f'伺服器錯誤: {str(e)}'})


@permission_required("importer")
@csrf_protect
def toggle_manifest_visibility(request):
    """Toggle manifest visibility"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': '無效請求'})

    try:
        data = json.loads(request.body.decode('utf-8'))
        manifest_numbers = data.get('manifestNumbers', [])
        action = data.get('action', 'hide')

        if not manifest_numbers:
            return JsonResponse({'success': False, 'error': '未選擇任何聯單'})

        with transaction.atomic():
            updated_count = Manifest.objects.filter(
                manifest_number__in=manifest_numbers
            ).update(is_visible=(action == 'show'))

        return JsonResponse({
            'success': True,
            'updatedCount': updated_count,
            'action': action
        })

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': '無效的 JSON 數據'})
    except Exception as e:
        logger.error(f"Toggle visibility error: {str(e)}", exc_info=True)
        return JsonResponse({'success': False, 'error': f'伺服器錯誤: {str(e)}'})


@permission_required("importer")
@csrf_protect
def batch_import(request):
    """Batch import manifests with optimized performance and conflict detection"""
    if request.method != "POST":
        return JsonResponse({"success": False, "error": "無效請求"})

    try:
        data = json.loads(request.body.decode('utf-8'))
        manifest_type = data.get("manifestType")
        rows = data.get("rows", [])
        override_conflicts = data.get("override_conflicts", False)

        logger.info(f"Batch import started: {len(rows)} rows, type={manifest_type}, override={override_conflicts}")

        if not manifest_type or not rows:
            return JsonResponse({"success": False, "error": "缺少必要參數"})

        # Security check: Verify override permission
        if override_conflicts:
            from MedicalWasteManagementSystem.permissions import has_override_permission
            if not has_override_permission(request.user, 'transportation'):
                logger.warning(f"User {request.user.username} attempted override without permission")
                return JsonResponse({"success": False, "error": "您沒有覆寫資料的權限"})

        results = {
            "total": len(rows),
            "success": 0,
            "failed": [],
            "conflicts": []
        }

        # ===== STEP 1: Preload ALL lookup tables (12 queries total) =====
        logger.debug("Preloading lookup tables...")

        # Extract all unique codes from rows
        enterprise_codes = set()
        waste_codes = set()
        process_codes = set()
        transporter_codes = set()
        treatment_facility_codes = set()
        recycler_codes = set()

        for row in rows:
            enterprise_codes.add(row.get('事業機構代碼', '').strip())
            waste_codes.add(row.get('廢棄物代碼' if manifest_type == 'disposal' else '物質代碼', '').strip())
            process_codes.add(row.get('製程代碼', '').strip() or 'DEFAULT')
            transporter_codes.add(row.get('清除者代碼', '').strip())
            if manifest_type == 'disposal':
                treatment_facility_codes.add(row.get('處理者代碼', '').strip())
            else:
                recycler_codes.add(row.get('再利用者代碼', '').strip())

        # Remove empty strings
        enterprise_codes.discard('')
        waste_codes.discard('')
        process_codes.discard('')
        transporter_codes.discard('')
        treatment_facility_codes.discard('')
        recycler_codes.discard('')

        # Bulk fetch all lookup tables
        enterprises = {e.enterprise_code: e for e in Enterprise.objects.filter(enterprise_code__in=enterprise_codes)}
        wastes = {w.waste_substance_code: w for w in WasteSubstance.objects.filter(waste_substance_code__in=waste_codes)}
        processes = {p.process_code: p for p in Process.objects.filter(process_code__in=process_codes)}
        transporters = {t.transporter_code: t for t in Transporter.objects.filter(transporter_code__in=transporter_codes)}

        if manifest_type == 'disposal':
            treatment_facilities = {tf.treatment_facility_code: tf for tf in TreatmentFacility.objects.filter(treatment_facility_code__in=treatment_facility_codes)}
        else:
            recyclers = {r.recycler_code: r for r in Recycler.objects.filter(recycler_code__in=recycler_codes)}

        # Preload WasteSubstanceId (process + waste_substance combinations)
        waste_substance_ids = {}
        for ws in WasteSubstanceId.objects.filter(
            process__process_code__in=process_codes,
            waste_substance_code__waste_substance_code__in=waste_codes
        ).select_related('process', 'waste_substance_code'):
            key = (ws.process.process_code, ws.waste_substance_code.waste_substance_code)
            waste_substance_ids[key] = ws

        logger.debug(f"Preloaded: {len(enterprises)} enterprises, {len(wastes)} wastes, {len(processes)} processes")

        # ===== STEP 2: Preload conflict detection data (1 query) =====
        manifest_numbers = [row.get('聯單編號', '').strip() for row in rows]
        manifest_numbers = [mn for mn in manifest_numbers if mn]  # Remove empty

        existing_manifests_data = Manifest.objects.filter(
            manifest_number__in=manifest_numbers
        ).select_related(
            'waste_substance_id__process',
            'waste_substance_id__waste_substance_code'
        ).values(
            'manifest_number',
            'waste_substance_id',
            'waste_substance_id__process__process_code',
            'waste_substance_id__waste_substance_code__waste_substance_code'
        )

        # Build conflict map: key = (manifest_number, process_code, waste_code), value = waste_substance_id
        conflict_map = {}
        for m in existing_manifests_data:
            key = (
                m['manifest_number'],
                m['waste_substance_id__process__process_code'],
                m['waste_substance_id__waste_substance_code__waste_substance_code']
            )
            conflict_map[key] = m['waste_substance_id']

        logger.debug(f"Conflict map built with {len(conflict_map)} existing manifests")

        # ===== STEP 3: Process all rows with O(1) lookups =====
        rows_to_process = []

        for idx, row in enumerate(rows):
            manifest_number = row.get('聯單編號', '').strip()

            if not manifest_number:
                results["failed"].append({
                    "index": idx,
                    "reason": "缺少聯單編號"
                })
                continue

            # Extract codes for conflict detection
            process_code = row.get('製程代碼', '').strip() or 'DEFAULT'
            waste_substance_code = row.get('廢棄物代碼' if manifest_type == 'disposal' else '物質代碼', '').strip()

            # O(1) conflict check via hash map
            conflict_key = (manifest_number, process_code, waste_substance_code)
            has_conflict = conflict_key in conflict_map

            if has_conflict and not override_conflicts:
                # Conflict found and not overriding
                results["conflicts"].append({
                    "index": idx,
                    "manifestNumber": manifest_number,
                    "wasteSubstanceId": conflict_map[conflict_key],
                    "processCode": process_code,
                    "data": row
                })
            else:
                # No conflict OR user chose to override
                rows_to_process.append((idx, row))

        # ===== STEP 4: Create all manifests with retry logic for SQLite locks =====
        if rows_to_process:
            max_retries = 3
            for idx, row in rows_to_process:
                retry_count = 0
                success = False

                while retry_count < max_retries and not success:
                    try:
                        with transaction.atomic():
                            create_manifest_from_row_optimized(
                                row,
                                manifest_type,
                                override_conflicts,
                                enterprises,
                                wastes,
                                processes,
                                waste_substance_ids,
                                transporters,
                                treatment_facilities if manifest_type == 'disposal' else recyclers
                            )
                        results["success"] += 1
                        success = True
                    except OperationalError as e:
                        if 'database is locked' in str(e):
                            retry_count += 1
                            if retry_count < max_retries:
                                logger.warning(f"Database locked for row {idx}, retrying ({retry_count}/{max_retries})...")
                                time.sleep(0.1 * retry_count)  # Exponential backoff
                            else:
                                logger.error(f"Database locked for row {idx} after {max_retries} retries")
                                results["failed"].append({
                                    "index": idx,
                                    "reason": "資料庫鎖定，請稍後重試"
                                })
                        else:
                            logger.error(f"Database error creating manifest from row {idx}: {str(e)}", exc_info=True)
                            results["failed"].append({
                                "index": idx,
                                "reason": str(e)
                            })
                            break
                    except Exception as e:
                        logger.error(f"Error creating manifest from row {idx}: {str(e)}", exc_info=True)
                        results["failed"].append({
                            "index": idx,
                            "reason": str(e)
                        })
                        break

        logger.info(f"Batch import completed: {results['success']} success, {len(results['failed'])} failed, {len(results['conflicts'])} conflicts")

        # If there are unresolved conflicts
        if results["conflicts"] and not override_conflicts:
            return JsonResponse({
                "success": False,
                "error": "資料衝突",
                "results": results
            })

        return JsonResponse({"success": True, "results": results})

    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "無效的 JSON 數據"})
    except Exception as e:
        logger.error(f"Batch import error: {str(e)}", exc_info=True)
        return JsonResponse({"success": False, "error": f"伺服器錯誤: {str(e)}"})


def create_manifest_from_row_optimized(row, manifest_type, override_conflicts,
                                       enterprises, wastes, processes, waste_substance_ids,
                                       transporters, treatment_facilities_or_recyclers):
    """
    Optimized version: Create manifest using preloaded lookup tables (no N+1 queries)

    Parameters:
        row: CSV row data
        manifest_type: 'disposal' or 'reuse'
        override_conflicts: whether to override existing manifests
        enterprises: dict {enterprise_code: Enterprise object}
        wastes: dict {waste_substance_code: WasteSubstance object}
        processes: dict {process_code: Process object}
        waste_substance_ids: dict {(process_code, waste_code): WasteSubstanceId object}
        transporters: dict {transporter_code: Transporter object}
        treatment_facilities_or_recyclers: dict {code: TreatmentFacility or Recycler object}
    """
    # Extract data
    manifest_number = row.get('聯單編號', '').strip()
    enterprise_code = row.get('事業機構代碼', '').strip()
    enterprise_name = row.get('事業機構名稱', '').strip()
    waste_substance_code = row.get('廢棄物代碼' if manifest_type == 'disposal' else '物質代碼', '').strip()
    waste_substance_name = row.get('廢棄物名稱' if manifest_type == 'disposal' else '物質名稱', '').strip()
    process_code = row.get('製程代碼', '').strip() or 'DEFAULT'
    process_name = row.get('製程名稱', '').strip()
    declared_weight = float(row.get('申報重量', 0) or 0)
    vehicle_number = row.get('運載車號', '').strip()

    if not all([manifest_number, enterprise_code, waste_substance_code]):
        raise ValueError("缺少必要欄位：聯單編號、事業機構代碼、廢棄物代碼")

    # Get or create enterprise (use preloaded dict, create if not exists)
    enterprise = enterprises.get(enterprise_code)
    if not enterprise:
        enterprise, _ = Enterprise.objects.get_or_create(
            enterprise_code=enterprise_code,
            defaults={'enterprise_name': enterprise_name}
        )
        enterprises[enterprise_code] = enterprise

    # Get or create waste substance
    waste_substance = wastes.get(waste_substance_code)
    if not waste_substance:
        waste_substance, _ = WasteSubstance.objects.get_or_create(
            waste_substance_code=waste_substance_code,
            defaults={'waste_substance_name': waste_substance_name}
        )
        wastes[waste_substance_code] = waste_substance

    # Get or create process
    process = processes.get(process_code)
    if not process:
        process, _ = Process.objects.get_or_create(
            process_code=process_code,
            defaults={'process_name': process_name or '預設製程'}
        )
        processes[process_code] = process

    # Get or create WasteSubstanceId
    ws_key = (process_code, waste_substance_code)
    waste_substance_id_obj = waste_substance_ids.get(ws_key)
    if not waste_substance_id_obj:
        waste_substance_id_obj, _ = WasteSubstanceId.objects.get_or_create(
            process=process,
            waste_substance_code=waste_substance
        )
        waste_substance_ids[ws_key] = waste_substance_id_obj

    # Create or get declaration
    declaration_datetime = parse_datetime(row.get('申報日期', ''), row.get('申報時間', ''))
    declaration_code = f"{manifest_number}-{enterprise_code}-{declaration_datetime.strftime('%Y%m%d')}"

    declaration, _ = Declaration.objects.get_or_create(
        declaration_code=declaration_code,
        defaults={
            'enterprise': enterprise,
            'declaration_datetime': declaration_datetime,
            'declared_weight': declared_weight
        }
    )

    # Get or create transporter
    transporter_code = row.get('清除者代碼', '').strip()
    transporter_name = row.get('清除者名稱', '').strip()

    if not transporter_code:
        transporter_code = 'DEFAULT'
        transporter_name = '預設清除者'

    transporter = transporters.get(transporter_code)
    if not transporter:
        transporter, _ = Transporter.objects.get_or_create(
            transporter_code=transporter_code,
            defaults={
                'transporter_name': transporter_name,
                'other_transporters': row.get('其它清除者', '')
            }
        )
        transporters[transporter_code] = transporter

    # Create transport vehicle
    transport_vehicle_number = row.get('清除者運載車號' if manifest_type == 'disposal' else '清除者實際運載車號', '') or row.get('運載車號', '')
    if not transport_vehicle_number:
        transport_vehicle_number = f"DEFAULT-{transporter_code}"

    transport_vehicle, _ = TransportVehicle.objects.get_or_create(
        transport_vehicle_number=transport_vehicle_number,
        defaults={'transporter': transporter}
    )

    # Create transportation
    transportation_datetime = parse_datetime(row.get('清運日期', ''), row.get('清運時間', ''))
    delivery_datetime = parse_datetime(row.get('運送日期', ''), row.get('運送時間', ''))
    transportation_code = f"{manifest_number}-{transporter_code}-{transportation_datetime.strftime('%Y%m%d%H%M%S')}"

    transportation, _ = Transportation.objects.get_or_create(
        transportation_code=transportation_code,
        defaults={
            'transporter': transporter,
            'transportation_datetime': transportation_datetime,
            'transport_vehicle': transport_vehicle,
            'delivery_datetime': delivery_datetime
        }
    )

    # Handle treatment or recovery
    treatment = None
    recovery = None

    if manifest_type == 'disposal':
        treatment_facility_code = row.get('處理者代碼', '').strip()
        if treatment_facility_code:
            treatment_facility = treatment_facilities_or_recyclers.get(treatment_facility_code)
            if not treatment_facility:
                treatment_facility, _ = TreatmentFacility.objects.get_or_create(
                    treatment_facility_code=treatment_facility_code,
                    defaults={'treatment_facility_name': row.get('處理者名稱', '').strip()}
                )
                treatment_facilities_or_recyclers[treatment_facility_code] = treatment_facility

            treatment_vehicle_number = row.get('處理者運載車號', '') or f"DEFAULT-{treatment_facility_code}"
            treatment_vehicle, _ = TreatmentVehicle.objects.get_or_create(
                treatment_vehicle_number=treatment_vehicle_number,
                defaults={'treatment_facility': treatment_facility}
            )

            receipt_datetime = parse_datetime(row.get('收受日期', ''), row.get('收受時間', ''))
            treatment_completion_datetime = parse_datetime(row.get('處理完成日期', ''), row.get('處理完成時間', ''))
            treatment_code = f"{manifest_number}-{treatment_facility_code}-{receipt_datetime.strftime('%Y%m%d%H%M%S')}"

            treatment, _ = Treatment.objects.get_or_create(
                treatment_code=treatment_code,
                defaults={
                    'treatment_facility': treatment_facility,
                    'receipt_datetime': receipt_datetime,
                    'treatment_vehicle': treatment_vehicle,
                    'intermediate_treatment_method': row.get('中間處理方式', ''),
                    'final_disposal_method': row.get('最終處置方式', ''),
                    'treatment_completion_datetime': treatment_completion_datetime
                }
            )

    elif manifest_type == 'reuse':
        recycler_code = row.get('再利用者代碼', '').strip()
        if recycler_code:
            recycler = treatment_facilities_or_recyclers.get(recycler_code)
            if not recycler:
                recycler, _ = Recycler.objects.get_or_create(
                    recycler_code=recycler_code,
                    defaults={
                        'recycler_name': row.get('再利用者名稱', '').strip(),
                        'recycling_purpose': row.get('再利用用途', ''),
                        'recycling_purpose_description': row.get('再利用用途說明', ''),
                        'recycling_method': row.get('再利用方式', ''),
                        'recycler_type': row.get('再利用者性質', ''),
                        'recycling_completion_datetime': parse_datetime(row.get('再利用完成時間', ''), None),
                        'actual_recycler_vehicle_number': row.get('再利用者實際運載車號', '')
                    }
                )
                treatment_facilities_or_recyclers[recycler_code] = recycler

            recovery_vehicle_number = row.get('再利用者實際運載車號', '') or f"DEFAULT-{recycler_code}"
            recovery_vehicle, _ = RecoveryVehicle.objects.get_or_create(
                recovery_vehicle_number=recovery_vehicle_number,
                defaults={'recycler': recycler}
            )

            recovery_datetime = parse_datetime(row.get('回收日期', ''), row.get('回收時間', ''))
            recovery_code = f"{manifest_number}-{recycler_code}-{recovery_datetime.strftime('%Y%m%d%H%M%S')}"

            recovery, _ = Recovery.objects.get_or_create(
                recovery_code=recovery_code,
                defaults={
                    'recycler': recycler,
                    'recovery_datetime': recovery_datetime,
                    'recovery_vehicle': recovery_vehicle
                }
            )

    # Create or update manifest
    existing_manifest = Manifest.objects.filter(
        manifest_number=manifest_number,
        waste_substance_id=waste_substance_id_obj
    ).first()

    if existing_manifest:
        if override_conflicts:
            existing_manifest.declaration = declaration
            existing_manifest.vehicle_number = vehicle_number
            existing_manifest.transportation = transportation
            existing_manifest.treatment = treatment
            existing_manifest.recovery = recovery
            existing_manifest.is_visible = True
            existing_manifest.save()
            return existing_manifest
        else:
            raise ValueError(f"聯單 {manifest_number} 已存在")
    else:
        manifest = Manifest.objects.create(
            manifest_number=manifest_number,
            waste_substance_id=waste_substance_id_obj,
            declaration=declaration,
            vehicle_number=vehicle_number,
            transportation=transportation,
            treatment=treatment,
            recovery=recovery,
            is_visible=True
        )
        return manifest


def create_manifest_from_row(row, manifest_type, override_conflicts=False):
    """Create or update manifest from CSV row data with proper conflict handling"""
    with transaction.atomic():
        # Extract and validate data
        manifest_number = row.get('聯單編號', '').strip()
        enterprise_code = row.get('事業機構代碼', '').strip()
        enterprise_name = row.get('事業機構名稱', '').strip()
        waste_substance_code = row.get('廢棄物代碼' if manifest_type == 'disposal' else '物質代碼', '').strip()
        waste_substance_name = row.get('廢棄物名稱' if manifest_type == 'disposal' else '物質名稱', '').strip()
        process_code = row.get('製程代碼', '').strip()
        process_name = row.get('製程名稱', '').strip()
        declared_weight = float(row.get('申報重量', 0) or 0)
        vehicle_number = row.get('運載車號', '').strip()
        waste_substance_id_from_csv = row.get('廢棄物ID', '').strip()

        if not all([manifest_number, enterprise_code, waste_substance_code]):
            raise ValueError("缺少必要欄位：聯單編號、事業機構代碼、廢棄物代碼")

        # Create or get enterprise
        enterprise, _ = Enterprise.objects.get_or_create(
            enterprise_code=enterprise_code,
            defaults={'enterprise_name': enterprise_name}
        )

        # Create or get waste substance
        waste_substance, _ = WasteSubstance.objects.get_or_create(
            waste_substance_code=waste_substance_code,
            defaults={'waste_substance_name': waste_substance_name}
        )

        # Create or get process
        if process_code:
            process, _ = Process.objects.get_or_create(
                process_code=process_code,
                defaults={'process_name': process_name}
            )
        else:
            # Create a default process if not provided
            process, _ = Process.objects.get_or_create(
                process_code='DEFAULT',
                defaults={'process_name': '預設製程'}
            )

        # Handle waste_substance_id properly
        waste_substance_id_obj = None
        if waste_substance_id_from_csv:
            try:
                # Try to find existing WasteSubstanceId by ID
                waste_substance_id_obj = WasteSubstanceId.objects.get(
                    waste_substance_id=int(waste_substance_id_from_csv)
                )
            except (ValueError, WasteSubstanceId.DoesNotExist):
                # If not found or invalid, create new one
                pass

        if not waste_substance_id_obj:
            # Create or get waste substance ID
            waste_substance_id_obj, _ = WasteSubstanceId.objects.get_or_create(
                process=process,
                waste_substance_code=waste_substance,
            )

        # Create or get declaration
        declaration_datetime = parse_datetime(
            row.get('申報日期', ''),
            row.get('申報時間', '')
        )

        # Use a unique declaration code that includes date to avoid conflicts
        declaration_code = f"{manifest_number}-{enterprise_code}-{declaration_datetime.strftime('%Y%m%d')}"

        declaration, declaration_created = Declaration.objects.get_or_create(
            declaration_code=declaration_code,
            defaults={
                'enterprise': enterprise,
                'declaration_datetime': declaration_datetime,
                'declared_weight': declared_weight
            }
        )

        # Update declaration if it exists
        if not declaration_created:
            declaration.enterprise = enterprise
            declaration.declaration_datetime = declaration_datetime
            declaration.declared_weight = declared_weight
            declaration.save()

        # Create transporter
        transporter_code = row.get('清除者代碼', '').strip()
        transporter_name = row.get('清除者名稱', '').strip()
        if transporter_code:
            transporter, _ = Transporter.objects.get_or_create(
                transporter_code=transporter_code,
                defaults={
                    'transporter_name': transporter_name,
                    'other_transporters': row.get('其它清除者', '')
                }
            )
        else:
            # Create default transporter
            transporter, _ = Transporter.objects.get_or_create(
                transporter_code='DEFAULT',
                defaults={'transporter_name': '預設清除者'}
            )

        # Create transportation vehicle
        transport_vehicle_number = row.get('清除者運載車號' if manifest_type == 'disposal' else '清除者實際運載車號',
                                           '') or row.get('運載車號', '')
        if transport_vehicle_number:
            transport_vehicle, _ = TransportVehicle.objects.get_or_create(
                transport_vehicle_number=transport_vehicle_number,
                defaults={'transporter': transporter}
            )
        else:
            # Create default vehicle
            default_vehicle_number = f"DEFAULT-{transporter_code}"
            transport_vehicle, _ = TransportVehicle.objects.get_or_create(
                transport_vehicle_number=default_vehicle_number,
                defaults={'transporter': transporter}
            )

        # Create transportation
        transportation_datetime = parse_datetime(
            row.get('清運日期', ''),
            row.get('清運時間', '')
        )
        delivery_datetime = parse_datetime(
            row.get('運送日期', ''),
            row.get('運送時間', '')
        )

        transportation_code = f"{manifest_number}-{transporter_code}-{transportation_datetime.strftime('%Y%m%d%H%M%S')}"
        transportation, transportation_created = Transportation.objects.get_or_create(
            transportation_code=transportation_code,
            defaults={
                'transporter': transporter,
                'transportation_datetime': transportation_datetime,
                'transport_vehicle': transport_vehicle,
                'delivery_datetime': delivery_datetime
            }
        )

        # Update transportation if it exists
        if not transportation_created:
            transportation.transporter = transporter
            transportation.transportation_datetime = transportation_datetime
            transportation.transport_vehicle = transport_vehicle
            transportation.delivery_datetime = delivery_datetime
            transportation.save()

        # Handle treatment or recovery based on manifest type
        treatment = None
        recovery = None

        if manifest_type == 'disposal':
            # Create treatment if treatment data exists
            treatment_facility_code = row.get('處理者代碼', '').strip()
            if treatment_facility_code:
                treatment_facility_name = row.get('處理者名稱', '').strip()

                # Create treatment facility
                treatment_facility, _ = TreatmentFacility.objects.get_or_create(
                    treatment_facility_code=treatment_facility_code,
                    defaults={
                        'treatment_facility_name': treatment_facility_name
                    }
                )

                # Create treatment vehicle
                treatment_vehicle_number = row.get('處理者運載車號', '') or f"DEFAULT-{treatment_facility_code}"
                treatment_vehicle, _ = TreatmentVehicle.objects.get_or_create(
                    treatment_vehicle_number=treatment_vehicle_number,
                    defaults={'treatment_facility': treatment_facility}
                )

                # Create treatment
                receipt_datetime = parse_datetime(
                    row.get('收受日期', ''),
                    row.get('收受時間', '')
                )
                treatment_completion_datetime = parse_datetime(
                    row.get('處理完成日期', ''),
                    row.get('處理完成時間', '')
                )
                treatment_code = f"{manifest_number}-{treatment_facility_code}-{receipt_datetime.strftime('%Y%m%d%H%M%S')}"
                treatment, treatment_created = Treatment.objects.get_or_create(
                    treatment_code=treatment_code,
                    defaults={
                        'treatment_facility': treatment_facility,
                        'receipt_datetime': receipt_datetime,
                        'treatment_vehicle': treatment_vehicle,
                        'intermediate_treatment_method': row.get('中間處理方式', ''),
                        'final_disposal_method': row.get('最終處置方式', ''),
                        'treatment_completion_datetime': treatment_completion_datetime
                    }
                )

                # Update treatment if it exists
                if not treatment_created:
                    treatment.treatment_facility = treatment_facility
                    treatment.receipt_datetime = receipt_datetime
                    treatment.treatment_vehicle = treatment_vehicle
                    treatment.intermediate_treatment_method = row.get('中間處理方式', '')
                    treatment.final_disposal_method = row.get('最終處置方式', '')
                    treatment.treatment_completion_datetime = treatment_completion_datetime
                    treatment.save()

        elif manifest_type == 'reuse':
            # Create recovery if recycler data exists
            recycler_code = row.get('再利用者代碼', '').strip()
            if recycler_code:
                recycler_name = row.get('再利用者名稱', '').strip()

                # Create recycler
                recycler, recycler_created = Recycler.objects.get_or_create(
                    recycler_code=recycler_code,
                    defaults={
                        'recycler_name': recycler_name,
                        'recycling_purpose': row.get('再利用用途', ''),
                        'recycling_purpose_description': row.get('再利用用途說明', ''),
                        'recycling_method': row.get('再利用方式', ''),
                        'recycler_type': row.get('再利用者性質', ''),
                        'recycling_completion_datetime': parse_datetime(
                            row.get('再利用完成時間', ''), None
                        ),
                        'actual_recycler_vehicle_number': row.get('再利用者實際運載車號', '')
                    }
                )

                # Update recycler if it exists
                if not recycler_created:
                    recycler.recycler_name = recycler_name
                    recycler.recycling_purpose = row.get('再利用用途', '')
                    recycler.recycling_purpose_description = row.get('再利用用途說明', '')
                    recycler.recycling_method = row.get('再利用方式', '')
                    recycler.recycler_type = row.get('再利用者性質', '')
                    recycler.recycling_completion_datetime = parse_datetime(
                        row.get('再利用完成時間', ''), None
                    )
                    recycler.actual_recycler_vehicle_number = row.get('再利用者實際運載車號', '')
                    recycler.save()

                # Create recovery vehicle
                recovery_vehicle_number = row.get('再利用者實際運載車號', '') or f"DEFAULT-{recycler_code}"
                recovery_vehicle, _ = RecoveryVehicle.objects.get_or_create(
                    recovery_vehicle_number=recovery_vehicle_number,
                    defaults={'recycler': recycler}
                )

                # Create recovery
                recovery_datetime = parse_datetime(
                    row.get('回收日期', ''),
                    row.get('回收時間', '')
                )
                recovery_code = f"{manifest_number}-{recycler_code}-{recovery_datetime.strftime('%Y%m%d%H%M%S')}"
                recovery, recovery_created = Recovery.objects.get_or_create(
                    recovery_code=recovery_code,
                    defaults={
                        'recycler': recycler,
                        'recovery_datetime': recovery_datetime,
                        'recovery_vehicle': recovery_vehicle
                    }
                )

                # Update recovery if it exists
                if not recovery_created:
                    recovery.recycler = recycler
                    recovery.recovery_datetime = recovery_datetime
                    recovery.recovery_vehicle = recovery_vehicle
                    recovery.save()

        # Manifest creation/update logic to handle unique constraints properly
        try:
            # Try to find existing manifest by EXACT match (manifest_number + waste_substance_id)
            existing_manifest = Manifest.objects.filter(
                manifest_number=manifest_number,
                waste_substance_id=waste_substance_id_obj
            ).first()

            if existing_manifest:
                if override_conflicts:
                    # Update existing manifest (same unique key combination)
                    existing_manifest.declaration = declaration
                    existing_manifest.vehicle_number = vehicle_number
                    existing_manifest.transportation = transportation
                    existing_manifest.treatment = treatment
                    existing_manifest.recovery = recovery
                    existing_manifest.is_visible = True
                    existing_manifest.save()
                    logger.info(f"Updated existing manifest: {manifest_number}")
                    return existing_manifest
                else:
                    # Existing manifest found but override not allowed
                    raise ValueError(f"聯單 {manifest_number} 已存在，請選擇覆寫或跳過")
            else:
                # Check if there's a manifest with same manifest_number but different waste_substance_id
                existing_with_same_number = Manifest.objects.filter(
                    manifest_number=manifest_number
                ).first()

                if existing_with_same_number and override_conflicts:
                    # Delete the old one and create new one with correct waste_substance_id
                    logger.info(f"Deleting existing manifest with different waste_substance_id: {manifest_number}")
                    existing_with_same_number.delete()

                # Create new manifest
                manifest = Manifest.objects.create(
                    manifest_number=manifest_number,
                    waste_substance_id=waste_substance_id_obj,
                    declaration=declaration,
                    vehicle_number=vehicle_number,
                    transportation=transportation,
                    treatment=treatment,
                    recovery=recovery,
                    is_visible=True
                )
                logger.info(f"Created new manifest: {manifest_number}")
                return manifest

        except Exception as e:
            logger.error(f"Error in manifest creation/update: {str(e)}")
            raise e


@permission_required("importer")
@csrf_protect
def import_manifests(request):
    """Import manifest data from CSV file"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': '無效請求'})

    if 'file' not in request.FILES:
        return JsonResponse({'success': False, 'error': '未上傳檔案'})

    uploaded_file = request.FILES['file']
    manifest_type = request.POST.get('manifestType', 'disposal')

    if not uploaded_file.name.endswith('.csv'):
        return JsonResponse({'success': False, 'error': '請上傳 CSV 檔案'})

    try:
        # Read and detect encoding
        file_content = uploaded_file.read()
        encoding = detect_encoding(file_content)

        try:
            csv_content = file_content.decode(encoding)
        except UnicodeDecodeError:
            encoding = 'big5' if encoding == 'utf-8' else 'utf-8'
            csv_content = file_content.decode(encoding)

        # Parse CSV
        csv_file = io.StringIO(csv_content)
        reader = csv.DictReader(csv_file)

        # Validate headers
        field_mapping = DISPOSAL_FIELD_MAPPING if manifest_type == 'disposal' else REUSE_FIELD_MAPPING
        required_fields = ['聯單編號', '事業機構代碼', '申報重量']

        missing_fields = [field for field in required_fields if field not in reader.fieldnames]
        if missing_fields:
            return JsonResponse({
                'success': False,
                'error': f'CSV 檔案缺少必要欄位: {", ".join(missing_fields)}'
            })

        # Process data with conflict detection
        results = process_manifest_import_with_conflicts(reader, field_mapping, manifest_type)

        return JsonResponse({
            'success': True,
            'results': results
        })

    except Exception as e:
        logger.error(f"Import error: {str(e)}", exc_info=True)
        return JsonResponse({'success': False, 'error': f'匯入失敗: {str(e)}'})


def process_manifest_import_with_conflicts(reader, field_mapping, manifest_type):
    """Process CSV data with conflict detection"""
    results = {
        'total': 0,
        'success': 0,
        'failed': [],
        'conflicts': []
    }

    for row_idx, row in enumerate(reader, start=1):
        results['total'] += 1

        try:
            manifest_number = row.get('聯單編號', '').strip()
            if not manifest_number:
                results['failed'].append({
                    'row': row_idx,
                    'reason': '缺少聯單編號'
                })
                continue

            # Check for existing manifest
            existing_manifest = Manifest.objects.filter(
                manifest_number=manifest_number
            ).first()

            if existing_manifest:
                results['conflicts'].append({
                    'row': row_idx,
                    'manifestNumber': manifest_number,
                    'data': row
                })
            else:
                # Create new manifest
                create_manifest_from_row(row, manifest_type)
                results['success'] += 1

        except Exception as e:
            logger.error(f"Error processing row {row_idx}: {str(e)}", exc_info=True)
            results['failed'].append({
                'row': row_idx,
                'reason': str(e)
            })

    return results