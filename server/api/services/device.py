"""
Device Service - Business logic for device management
Handles device registration, whitelisting, and status tracking
"""

from typing import Optional, Dict, Any
from datetime import datetime, timezone
import re

from ..db import get_registry_collection, get_settings_collection


class DeviceService:
    """Service for managing IoT devices"""
    
    @staticmethod
    def normalize_mac_address(mac: str) -> str:
        """
        Normalize MAC address to uppercase colon-separated format.
        
        Args:
            mac: MAC address in any format
        
        Returns:
            Normalized MAC address: "AA:BB:CC:DD:EE:FF"
        
        Raises:
            ValueError: If MAC address is invalid
        """
        if not mac:
            raise ValueError("MAC address is required")
        
        mac_str = str(mac).strip().upper()
        mac_clean = ''.join(c for c in mac_str if c.isalnum())
        
        if len(mac_clean) != 12:
            raise ValueError(f"Invalid MAC address length: expected 12 hex characters, got {len(mac_clean)}")
        
        try:
            int(mac_clean, 16)
        except ValueError:
            raise ValueError(f"Invalid hexadecimal MAC address: {mac_clean}")
        
        return ':'.join(mac_clean[i:i+2] for i in range(0, 12, 2))
    
    @staticmethod
    def register_device(mac_address: str, device_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Ensure device registry entry exists, creating if missing.
        
        Args:
            mac_address: MAC address (will be normalized)
            device_id: Optional legacy device_id
        
        Returns:
            Registry entry document, or None if MAC is invalid
        """
        try:
            mac_normalized = DeviceService.normalize_mac_address(mac_address)
        except ValueError:
            return None
        
        registry = get_registry_collection()
        now = datetime.now(timezone.utc)
        
        entry = registry.find_one({'mac_address': mac_normalized})
        
        if entry:
            # Update existing entry
            update_data = {
                '$set': {
                    'last_data_received': now,
                    'updated_at': now
                }
            }
            
            if not entry.get('display_name'):
                update_data['$set']['display_name'] = mac_normalized
            
            if device_id and 'legacy_device_id' not in entry:
                update_data['$set']['legacy_device_id'] = device_id
            
            if 'whitelisted' not in entry:
                update_data['$set']['whitelisted'] = True
            
            registry.update_one({'mac_address': mac_normalized}, update_data)
            entry = registry.find_one({'mac_address': mac_normalized})
        else:
            # Create new entry
            entry = {
                'mac_address': mac_normalized,
                'display_name': mac_normalized,
                'created_at': now,
                'updated_at': now,
                'last_data_received': now,
                'whitelisted': True,  # Default for backward compatibility
            }
            if device_id:
                entry['legacy_device_id'] = device_id
            
            registry.insert_one(entry)
        
        return entry
    
    @staticmethod
    def is_whitelist_enabled() -> bool:
        """Check if MAC address whitelisting is globally enabled"""
        try:
            settings = get_settings_collection()
            setting = settings.find_one({'key': 'whitelist_enabled'})
            return setting.get('value', False) if setting else False
        except Exception as e:
            print(f"⚠️  Error checking whitelist setting: {e}")
            return False
    
    @staticmethod
    def is_mac_whitelisted(mac_address: str) -> bool:
        """
        Check if a MAC address is whitelisted.
        
        Args:
            mac_address: MAC address to check
        
        Returns:
            True if whitelisted, False otherwise
        """
        if not mac_address:
            return False
        
        try:
            mac_normalized = DeviceService.normalize_mac_address(mac_address)
            registry = get_registry_collection()
            entry = registry.find_one({'mac_address': mac_normalized})
            
            if entry:
                return entry.get('whitelisted', True)  # Default True for backward compatibility
            return False
        except Exception as e:
            print(f"⚠️  Error checking whitelist for {mac_address}: {e}")
            return False
    
    @staticmethod
    def get_device(mac_address: str) -> Optional[Dict[str, Any]]:
        """Get device by MAC address"""
        try:
            mac_normalized = DeviceService.normalize_mac_address(mac_address)
            registry = get_registry_collection()
            return registry.find_one({'mac_address': mac_normalized})
        except Exception:
            return None
    
    @staticmethod
    def resolve_device_identifier(device_identifier: str) -> Dict[str, str]:
        """
        Resolve device identifier to device_id and/or mac_address.
        
        The identifier can be:
        - A device_id (legacy)
        - A MAC address (new system)
        - A display_name (looked up in registry)
        
        Returns:
            dict with 'device_id' and/or 'mac_address' keys for filtering
        """
        if not device_identifier:
            return {}
        
        device_identifier = str(device_identifier).strip()
        
        # Try MAC address first
        try:
            mac_normalized = DeviceService.normalize_mac_address(device_identifier)
            result = {'mac_address': mac_normalized}
            
            # Try to get associated device_id
            try:
                registry = get_registry_collection()
                entry = registry.find_one({'mac_address': mac_normalized})
                if entry and entry.get('legacy_device_id'):
                    result['device_id'] = entry.get('legacy_device_id')
            except Exception:
                pass
            
            return result
        except ValueError:
            pass
        
        # Check if it's a display_name
        try:
            registry = get_registry_collection()
            entry = registry.find_one({'display_name': device_identifier})
            if entry:
                result = {}
                if entry.get('mac_address'):
                    result['mac_address'] = entry['mac_address']
                if entry.get('legacy_device_id'):
                    result['device_id'] = entry['legacy_device_id']
                if result:
                    return result
        except Exception:
            pass
        
        # Default: treat as device_id (legacy)
        result = {'device_id': device_identifier}
        try:
            registry = get_registry_collection()
            entry = registry.find_one({'legacy_device_id': device_identifier})
            if entry and entry.get('mac_address'):
                result['mac_address'] = entry['mac_address']
        except Exception:
            pass
        
        return result
