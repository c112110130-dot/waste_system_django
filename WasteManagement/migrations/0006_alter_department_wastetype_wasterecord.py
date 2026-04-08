# Data migration to initialize department data
from django.db import migrations


def initialize_department_data(apps, schema_editor):
    """Initialize default departments only - DO NOT auto-create waste types"""
    Department = apps.get_model('WasteManagement', 'Department')
    WasteType = apps.get_model('WasteManagement', 'WasteType')

    # REMOVED: Automatic waste type creation - let users create their own waste types
    # This was causing unwanted "各單位感染廢棄物" to be created automatically

    # Default department list
    default_departments = [
        'W102', '病理檢驗部(門診檢驗室)', 'W82', 'W103', 'W72', 'W71',
        '教學研究部', 'W91', 'W83', 'W81', 'W51', '新生兒加護', '燒燙傷',
        'GW07', 'EW01', 'EW02', 'GW03', 'GW05', '產後護理', 'W31', 'W36',
        'W73', 'W75', 'W66', '洗腎室', 'W62', 'W35', 'W63', 'W92', 'W52',
        '小兒加護', 'W37', 'W32', 'W65', 'W85', 'RICU', 'W55', '產房',
        'W105', 'RCC呼吸加護病房', 'W53',
        '手術室(3F-開刀房、門診手術室、門診開刀房、醫療大樓開刀房)',
        'AICU前區', 'AICU後區'
    ]

    # Create departments (only if they don't exist)
    created_count = 0
    for i, dept_name in enumerate(default_departments):
        dept, created = Department.objects.get_or_create(
            name=dept_name,
            defaults={
                'display_order': i + 1,
                'is_active': True
            }
        )
        if created:
            created_count += 1

    print(f"Created {created_count} new departments. Total departments: {Department.objects.count()}")


def reverse_initialize_department_data(apps, schema_editor):
    """Reverse function - remove only the departments we created"""
    Department = apps.get_model('WasteManagement', 'Department')
    WasteType = apps.get_model('WasteManagement', 'WasteType')

    # Default department list to remove
    default_departments = [
        'W102', '病理檢驗部(門診檢驗室)', 'W82', 'W103', 'W72', 'W71',
        '教學研究部', 'W91', 'W83', 'W81', 'W51', '新生兒加護', '燒燙傷',
        'GW07', 'EW01', 'EW02', 'GW03', 'GW05', '產後護理', 'W31', 'W36',
        'W73', 'W75', 'W66', '洗腎室', 'W62', 'W35', 'W63', 'W92', 'W52',
        '小兒加護', 'W37', 'W32', 'W65', 'W85', 'RICU', 'W55', '產房',
        'W105', 'RCC呼吸加護病房', 'W53',
        '手術室(3F-開刀房、門診手術室、門診開刀房、醫療大樓開刀房)',
        'AICU前區', 'AICU後區', '合計'
    ]

    # Remove departments
    Department.objects.filter(name__in=default_departments).delete()

    # Remove waste type
    WasteType.objects.filter(name='各單位感染廢棄物').delete()


class Migration(migrations.Migration):
    dependencies = [
        ('WasteManagement', '0005_department_wastetype_wasterecord'),
    ]

    operations = [
        migrations.RunPython(
            code=initialize_department_data,
            reverse_code=reverse_initialize_department_data,
        ),
    ]