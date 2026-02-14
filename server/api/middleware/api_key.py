"""
API Key Authentication Middleware
Validates X-API-Key header for device data ingestion
"""

import os
import json
from django.http import JsonResponse
from typing import Callable

from ..services import AuthService, DeviceService
from ..db import get_registry_collection


class ApiKeyMiddleware:
    """
    Middleware to validate API keys for device authentication.
    
    Supports grace period for legacy MAC-based authentication via ALLOW_LEGACY_AUTH env var.
    """
    
    def __init__(self, get_response: Callable):
        self.get_response = get_response
        self.allow_legacy = os.getenv('ALLOW_LEGACY_AUTH', 'true').lower() == 'true'
    
    def __call__(self, request):
        # Only apply to /api/data POST (device ingestion)
        if request.path == '/api/data' and request.method == 'POST':
            api_key = request.META.get('HTTP_X_API_KEY')
            
            # Grace period: allow legacy MAC whitelist authentication
            if self.allow_legacy and not api_key:
                # Let the view handle MAC whitelist validation
                return self.get_response(request)
            
            # API key required
            if not api_key:
                return JsonResponse({
                    'error': 'API key required',
                    'message': 'Include X-API-Key header with your device API key'
                }, status=401)
            
            # Verify API key
            is_valid, device_mac = self._verify_api_key(api_key)
            
            if not is_valid:
                return JsonResponse({
                    'error': 'Invalid API key',
                    'message': 'The provided API key is not valid'
                }, status=401)
            
            # Attach authenticated device MAC to request for use in views
            request.authenticated_device_mac = device_mac
        
        return self.get_response(request)
    
    def _verify_api_key(self, api_key: str) -> tuple[bool, str | None]:
        """
        Verify API key against device registry.
        
        Returns:
            Tuple of (is_valid, device_mac_address)
        """
        try:
            registry = get_registry_collection()
            
            # Hash the provided key
            key_hash = AuthService.hash_api_key(api_key)
            
            # Find device with matching API key hash
            device = registry.find_one({'api_key_hash': key_hash})
            
            if device:
                # Check if device is whitelisted (if whitelist is enabled)
                mac_address = device.get('mac_address')
                if DeviceService.is_whitelist_enabled():
                    if not device.get('whitelisted', True):
                        return False, None
                
                return True, mac_address
            
            return False, None
        
        except Exception as e:
            print(f"[ERROR] API key verification failed: {e}")
            return False, None
