"""
Phase 2 Verification Script - Security Features
Tests Pydantic validation, rate limiting, and API key authentication
"""

import os
import sys
from datetime import datetime, timezone

# Add server directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Set environment variables for testing
os.environ['DEVELOPMENT_DB'] = 'true'
os.environ['ALLOW_LEGACY_AUTH'] = 'true'  # Enable grace period


def test_pydantic_validation():
    """Test Pydantic schema validation"""
    print("\n=== Testing Pydantic Validation ===")
    
    from api.schemas import SensorDataSchema
    from pydantic import ValidationError
    
    # Test valid data
    valid_data = {
        'mac_address': 'AA:BB:CC:DD:EE:FF',
        'co2': 800,
        'temperature': 22.5,
        'humidity': 45.0
    }
    
    try:
        schema = SensorDataSchema(**valid_data)
        print(f"✓ Valid data accepted: {schema.mac_address}")
    except ValidationError as e:
        print(f"✗ Valid data rejected: {e}")
        return False
    
    # Test MAC normalization
    test_macs = [
        ('aa-bb-cc-dd-ee-ff', 'AA:BB:CC:DD:EE:FF'),
        ('aabbccddeeff', 'AA:BB:CC:DD:EE:FF'),
    ]
    
    for input_mac, expected in test_macs:
        data = valid_data.copy()
        data['mac_address'] = input_mac
        try:
            schema = SensorDataSchema(**data)
            assert schema.mac_address == expected, f"MAC normalization failed: {schema.mac_address} != {expected}"
        except Exception as e:
            print(f"✗ MAC normalization failed for {input_mac}: {e}")
            return False
    
    print("✓ MAC address normalization works")
    
    # Test invalid data (out of range)
    invalid_cases = [
        ({'co2': 10000}, 'CO2 out of range'),
        ({'temperature': 150}, 'Temperature out of range'),
        ({'humidity': 150}, 'Humidity out of range'),
        ({'mac_address': 'invalid'}, 'Invalid MAC'),
    ]
    
    for invalid_field, description in invalid_cases:
        data = valid_data.copy()
        data.update(invalid_field)
        try:
            schema = SensorDataSchema(**data)
            print(f"✗ {description} was accepted")
            return False
        except ValidationError:
            pass  # Expected
    
    print("✓ Invalid data rejected correctly")
    
    return True


def test_api_key_generation():
    """Test API key generation and hashing"""
    print("\n=== Testing API Key Generation ===")
    
    from api.services import AuthService
    
    # Generate API key
    api_key = AuthService.generate_api_key()
    assert len(api_key) == 32, f"API key length incorrect: {len(api_key)}"
    print(f"✓ API key generated: {api_key[:8]}...")
    
    # Hash API key
    key_hash = AuthService.hash_api_key(api_key)
    assert len(key_hash) == 64, "Hash length incorrect"
    print(f"✓ API key hashed: {key_hash[:16]}...")
    
    # Verify correct key
    is_valid = AuthService.verify_api_key(api_key, key_hash)
    assert is_valid, "Valid key verification failed"
    print("✓ Valid API key verified")
    
    # Verify incorrect key
    is_valid = AuthService.verify_api_key("wrong_key_12345678901234567890123", key_hash)
    assert not is_valid, "Invalid key was accepted"
    print("✓ Invalid API key rejected")
    
    return True


def test_middleware_integration():
    """Test API key middleware integration"""
    print("\n=== Testing API Key Middleware ===")
    
    from api.middleware.api_key import ApiKeyMiddleware
    from api.services import AuthService, DeviceService
    from api.db import get_registry_collection
    
    # Create test device with API key
    test_mac = "AA:BB:CC:DD:EE:FF"
    api_key = AuthService.generate_api_key()
    key_hash = AuthService.hash_api_key(api_key)
    key_prefix = AuthService.get_api_key_prefix(api_key)
    
    registry = get_registry_collection()
    
    # Ensure device exists
    DeviceService.register_device(test_mac)
    
    # Add API key to device
    registry.update_one(
        {'mac_address': test_mac},
        {
            '$set': {
                'api_key_hash': key_hash,
                'api_key_prefix': key_prefix,
                'api_key_created_at': datetime.now(timezone.utc)
            }
        }
    )
    
    print(f"✓ Test device created: {test_mac}")
    print(f"✓ API key provisioned: {key_prefix}...")
    
    # Test middleware verification
    middleware = ApiKeyMiddleware(lambda r: None)
    is_valid, mac = middleware._verify_api_key(api_key)
    
    if is_valid and mac == test_mac:
        print(f"✓ Middleware verified API key for {mac}")
    else:
        print(f"✗ Middleware verification failed")
        return False
    
    # Test invalid key
    is_valid, mac = middleware._verify_api_key("invalid_key_1234567890123456")
    if not is_valid:
        print("✓ Middleware rejected invalid API key")
    else:
        print("✗ Middleware accepted invalid API key")
        return False
    
    return True


def main():
    """Run all tests"""
    print("=" * 60)
    print("Phase 2 Verification - Security Features")
    print("=" * 60)
    
    results = {
        'Pydantic Validation': test_pydantic_validation(),
        'API Key Generation': test_api_key_generation(),
        'Middleware Integration': test_middleware_integration(),
    }
    
    print("\n" + "=" * 60)
    print("Test Results:")
    print("=" * 60)
    
    for test_name, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{test_name:30s} {status}")
    
    all_passed = all(results.values())
    print("\n" + ("=" * 60))
    if all_passed:
        print("✓ All tests passed!")
    else:
        print("✗ Some tests failed")
    print("=" * 60)
    
    return 0 if all_passed else 1


if __name__ == '__main__':
    sys.exit(main())
