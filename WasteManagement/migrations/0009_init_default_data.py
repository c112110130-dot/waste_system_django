"""
Data migration: Initialize default departments and waste types.

Linus-style:
- Simple: Just create the basic data needed
- Idempotent: Safe to run multiple times
- No magic: Clear and explicit
"""

from django.db import migrations


def create_default_departments(apps, schema_editor):
    """Create default department list"""
    Department = apps.get_model('WasteManagement', 'Department')

    # Default department list - from DepartmentWasteConfiguration.DEFAULT_DEPARTMENTS
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

    created_count = 0
    for i, dept_name in enumerate(default_departments, start=1):
        _, created = Department.objects.get_or_create(
            name=dept_name,
            defaults={
                'display_order': i,
                'is_active': True
            }
        )
        if created:
            created_count += 1

    print(f'[INFO] Departments: {created_count} created, {len(default_departments) - created_count} already existed')


def create_default_waste_type(apps, schema_editor):
    """Create the default waste type"""
    WasteType = apps.get_model('WasteManagement', 'WasteType')

    waste_type, created = WasteType.objects.get_or_create(
        name='感染性廢棄物',
        defaults={
            'unit': 'metric_ton',
            'is_active': True
        }
    )

    if created:
        print('[INFO] Created default waste type: 各單位感染廢棄物')
    else:
        print('[INFO] Default waste type already exists: 各單位感染廢棄物')


def reverse_func(apps, schema_editor):
    """
    Reverse migration: DO NOT delete data.

    Linus says: Never break userspace.
    Deleting production data is almost always wrong.
    """
    print('[INFO] Reverse migration: Data preserved (not deleted)')


class Migration(migrations.Migration):

    dependencies = [
        ('WasteManagement', '0008_delete_departmentwastetypemapping'),
    ]

    operations = [
        migrations.RunPython(create_default_departments, reverse_func),
        migrations.RunPython(create_default_waste_type, reverse_func),
    ]