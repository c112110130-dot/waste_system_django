"""
System initialization management command for MWMS.

Linus-style principles:
- Idempotent: Can run multiple times safely
- Fail fast: Exit on errors with clear messages
- Simple: Do one thing well - initialize system data
- No magic: Explicit is better than implicit
"""

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User, Group
from django.db import transaction
import getpass


class Command(BaseCommand):
    help = 'Initialize system: create permission groups and root account'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            type=str,
            help='Root username (default: root)',
            default='root'
        )
        parser.add_argument(
            '--skip-root',
            action='store_true',
            help='Skip root account creation (only create groups)'
        )

    def handle(self, *args, **options):
        """Main execution entry point"""
        self.stdout.write(self.style.SUCCESS('[INFO] Starting MWMS system initialization'))

        try:
            with transaction.atomic():
                self._create_permission_groups()

                if not options['skip_root']:
                    self._create_root_account(options['username'])

            self.stdout.write(self.style.SUCCESS('\n[SUCCESS] System initialization completed'))

        except Exception as e:
            raise CommandError(f'Initialization failed: {str(e)}')

    def _create_permission_groups(self):
        """Create the 5 permission groups"""
        self.stdout.write('\n[STEP] Creating permission groups...')

        # Simple list, no bullshit
        groups = ['root', 'moderator', 'staff', 'registrar', 'importer']

        created_count = 0
        existing_count = 0

        for group_name in groups:
            group, created = Group.objects.get_or_create(name=group_name)

            if created:
                self.stdout.write(f'  ✓ Created group: {group_name}')
                created_count += 1
            else:
                self.stdout.write(f'  - Group already exists: {group_name}')
                existing_count += 1

        self.stdout.write(
            f'\n  Summary: {created_count} created, {existing_count} already existed'
        )

    def _create_root_account(self, username):
        """Create root account with interactive password input"""
        self.stdout.write(f'\n[STEP] Creating root account: {username}')

        # Check if user already exists
        if User.objects.filter(username=username).exists():
            self.stdout.write(self.style.WARNING(f'  ! User "{username}" already exists'))

            # Ask if want to reset password
            response = input('  Reset password? (y/N): ').strip().lower()
            if response != 'y':
                self.stdout.write('  - Keeping existing account')
                return

            user = User.objects.get(username=username)
            action = 'reset'
        else:
            user = User(username=username)
            action = 'created'

        # Get password (interactive)
        while True:
            password = getpass.getpass('  Enter password for root: ')
            password_confirm = getpass.getpass('  Confirm password: ')

            if password != password_confirm:
                self.stdout.write(self.style.ERROR('  ✗ Passwords do not match, try again'))
                continue

            if len(password) < 3:
                self.stdout.write(self.style.ERROR('  ✗ Password too short (min 3 chars)'))
                continue

            break

        # Set user attributes
        user.set_password(password)
        user.is_superuser = True
        user.is_staff = True
        user.is_active = True
        user.save()

        # Add to root group
        root_group = Group.objects.get(name='root')
        user.groups.add(root_group)

        self.stdout.write(f'  ✓ Root account {action}: {username}')