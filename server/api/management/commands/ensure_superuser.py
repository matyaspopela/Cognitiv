"""
Django management command to ensure superuser exists
Reads credentials from environment variables and creates/updates superuser
"""

import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = 'Ensure superuser exists from environment variables (ADMIN_USERNAME, ADMIN_PASSWORD)'
    
    def handle(self, *args, **options):
        User = get_user_model()
        
        # Read from environment variables
        username = os.getenv('ADMIN_USERNAME', 'admin')
        password = os.getenv('ADMIN_PASSWORD')
        email = os.getenv('ADMIN_EMAIL', 'admin@cognitiv.local')
        
        if not password:
            self.stdout.write(self.style.ERROR(
                'ADMIN_PASSWORD environment variable not set. Cannot create superuser.'
            ))
            return
        
        # Check if user already exists
        if User.objects.filter(username=username).exists():
            user = User.objects.get(username=username)
            
            # Update password if changed
            if not user.check_password(password):
                user.set_password(password)
                user.save()
                self.stdout.write(self.style.SUCCESS(
                    f'✓ Updated password for superuser: {username}'
                ))
            else:
                self.stdout.write(self.style.SUCCESS(
                    f'✓ Superuser already exists: {username}'
                ))
        else:
            # Create new superuser
            user = User.objects.create_superuser(
                username=username,
                email=email,
                password=password
            )
            self.stdout.write(self.style.SUCCESS(
                f'✓ Created superuser: {username} ({email})'
            ))
        
        # Ensure user is staff and superuser
        if not user.is_staff or not user.is_superuser:
            user.is_staff = True
            user.is_superuser = True
            user.save()
            self.stdout.write(self.style.SUCCESS(
                f'✓ Updated permissions for {username}'
            ))
