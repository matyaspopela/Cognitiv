"""
Django management command to generate API keys for devices
Usage: python manage.py generate_api_keys [--mac MAC_ADDRESS] [--all]
"""

from django.core.management.base import BaseCommand
from datetime import datetime, timezone

from api.services import AuthService
from api.db import get_registry_collection


class Command(BaseCommand):
    help = 'Generate API keys for devices in the registry'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--mac',
            type=str,
            help='Generate API key for specific MAC address'
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Generate API keys for all devices without keys'
        )
        parser.add_argument(
            '--regenerate',
            action='store_true',
            help='Regenerate API key even if device already has one'
        )
    
    def handle(self, *args, **options):
        registry = get_registry_collection()
        
        if options['mac']:
            # Generate for specific device
            self._generate_for_device(registry, options['mac'], options['regenerate'])
        elif options['all']:
            # Generate for all devices
            self._generate_for_all(registry, options['regenerate'])
        else:
            self.stdout.write(self.style.ERROR('Please specify --mac or --all'))
            return
    
    def _generate_for_device(self, registry, mac_address: str, regenerate: bool = False):
        """Generate API key for a specific device"""
        from api.services import DeviceService
        
        try:
            mac_normalized = DeviceService.normalize_mac_address(mac_address)
        except ValueError as e:
            self.stdout.write(self.style.ERROR(f'Invalid MAC address: {e}'))
            return
        
        device = registry.find_one({'mac_address': mac_normalized})
        
        if not device:
            self.stdout.write(self.style.ERROR(f'Device not found: {mac_normalized}'))
            return
        
        if device.get('api_key_hash') and not regenerate:
            self.stdout.write(self.style.WARNING(
                f'Device {mac_normalized} already has an API key. Use --regenerate to replace it.'
            ))
            return
        
        # Generate new API key
        api_key = AuthService.generate_api_key()
        api_key_hash = AuthService.hash_api_key(api_key)
        api_key_prefix = AuthService.get_api_key_prefix(api_key)
        
        # Update device
        registry.update_one(
            {'mac_address': mac_normalized},
            {
                '$set': {
                    'api_key_hash': api_key_hash,
                    'api_key_prefix': api_key_prefix,
                    'api_key_created_at': datetime.now(timezone.utc),
                    'updated_at': datetime.now(timezone.utc)
                }
            }
        )
        
        self.stdout.write(self.style.SUCCESS(
            f'\n✓ API Key generated for {mac_normalized} ({device.get("display_name", "Unnamed")})'
        ))
        self.stdout.write(self.style.WARNING(
            f'\n⚠️  SAVE THIS KEY - IT WILL NOT BE SHOWN AGAIN:\n'
        ))
        self.stdout.write(f'    {api_key}\n')
        self.stdout.write(f'    Prefix: {api_key_prefix}...\n')
    
    def _generate_for_all(self, registry, regenerate: bool = False):
        """Generate API keys for all devices"""
        query = {} if regenerate else {'api_key_hash': {'$exists': False}}
        devices = list(registry.find(query))
        
        if not devices:
            self.stdout.write(self.style.SUCCESS('All devices already have API keys'))
            return
        
        self.stdout.write(f'Generating API keys for {len(devices)} device(s)...\n')
        
        generated_keys = []
        
        for device in devices:
            mac_address = device['mac_address']
            
            # Generate new API key
            api_key = AuthService.generate_api_key()
            api_key_hash = AuthService.hash_api_key(api_key)
            api_key_prefix = AuthService.get_api_key_prefix(api_key)
            
            # Update device
            registry.update_one(
                {'mac_address': mac_address},
                {
                    '$set': {
                        'api_key_hash': api_key_hash,
                        'api_key_prefix': api_key_prefix,
                        'api_key_created_at': datetime.now(timezone.utc),
                        'updated_at': datetime.now(timezone.utc)
                    }
                }
            )
            
            generated_keys.append({
                'mac': mac_address,
                'name': device.get('display_name', 'Unnamed'),
                'key': api_key,
                'prefix': api_key_prefix
            })
        
        # Display all generated keys
        self.stdout.write(self.style.SUCCESS(f'\n✓ Generated {len(generated_keys)} API key(s)\n'))
        self.stdout.write(self.style.WARNING('⚠️  SAVE THESE KEYS - THEY WILL NOT BE SHOWN AGAIN:\n'))
        
        for item in generated_keys:
            self.stdout.write(f'\n  Device: {item["name"]} ({item["mac"]})')
            self.stdout.write(f'  API Key: {item["key"]}')
            self.stdout.write(f'  Prefix: {item["prefix"]}...\n')
