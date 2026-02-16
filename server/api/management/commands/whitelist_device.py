"""
Django management command to whitelist devices
Usage: python manage.py whitelist_device MAC_ADDRESS [--name NAME] [--legacy-id ID]
"""

from django.core.management.base import BaseCommand
from datetime import datetime, timezone

from api.services import DeviceService
from api.db import get_registry_collection


class Command(BaseCommand):
    help = 'Whitelist a device by MAC address, creating registry entry if needed'
    
    def add_arguments(self, parser):
        parser.add_argument(
            'mac_address',
            type=str,
            help='MAC address of device to whitelist (in any format)'
        )
        parser.add_argument(
            '--name',
            type=str,
            help='Display name for the device (optional)'
        )
        parser.add_argument(
            '--legacy-id',
            type=str,
            help='Legacy device_id for backward compatibility (optional)'
        )
    
    def handle(self, *args, **options):
        mac_address = options['mac_address']
        display_name = options.get('name')
        legacy_id = options.get('legacy_id')
        
        try:
            # Normalize MAC address
            mac_normalized = DeviceService.normalize_mac_address(mac_address)
        except ValueError as e:
            self.stdout.write(self.style.ERROR(f'Invalid MAC address: {e}'))
            return
        
        registry = get_registry_collection()
        now = datetime.now(timezone.utc)
        
        # Check if device already exists
        existing_device = registry.find_one({'mac_address': mac_normalized})
        
        if existing_device:
            # Update existing device
            update_data = {
                '$set': {
                    'whitelisted': True,
                    'updated_at': now
                }
            }
            
            # Update display name if provided
            if display_name:
                update_data['$set']['display_name'] = display_name
            
            # Add legacy_id if provided and not already set
            if legacy_id and 'legacy_device_id' not in existing_device:
                update_data['$set']['legacy_device_id'] = legacy_id
            
            registry.update_one({'mac_address': mac_normalized}, update_data)
            
            self.stdout.write(self.style.SUCCESS(
                f'\n✓ Device {mac_normalized} updated and whitelisted'
            ))
            if display_name:
                self.stdout.write(f'  Display name: {display_name}')
            if existing_device.get('whitelisted'):
                self.stdout.write(self.style.WARNING('  (Device was already whitelisted)'))
        else:
            # Create new device entry
            device_entry = {
                'mac_address': mac_normalized,
                'display_name': display_name or mac_normalized,
                'whitelisted': True,
                'created_at': now,
                'updated_at': now
            }
            
            if legacy_id:
                device_entry['legacy_device_id'] = legacy_id
            
            registry.insert_one(device_entry)
            
            self.stdout.write(self.style.SUCCESS(
                f'\n✓ Device {mac_normalized} created and whitelisted'
            ))
            self.stdout.write(f'  Display name: {device_entry["display_name"]}')
        
        self.stdout.write('\n✓ The device can now send data via MQTT (no API key needed)')
        self.stdout.write('  Make sure the ESP firmware is configured with:')
        self.stdout.write(f'  - MAC address in data payload: {mac_normalized}\n')
