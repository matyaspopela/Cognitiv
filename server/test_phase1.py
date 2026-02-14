"""
Phase 1 Verification Script
Tests the new database layer and service layer implementations
"""

import os
import sys
from datetime import datetime, timezone

# Add server directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Set environment variables for testing
os.environ['DEVELOPMENT_DB'] = 'true'  # Use dev database

def test_db_layer():
    """Test MongoManager singleton"""
    print("\n=== Testing Database Layer ===")
    
    from api.db import MongoManager, get_mongo_collection, get_registry_collection
    
    # Test singleton pattern
    manager1 = MongoManager.get_instance()
    manager2 = MongoManager.get_instance()
    assert manager1 is manager2, "Singleton pattern failed"
    print("✓ Singleton pattern works")
    
    # Test connection
    try:
        manager1.initialize()
        print("✓ MongoDB connection initialized")
    except Exception as e:
        print(f"✗ MongoDB connection failed: {e}")
        return False
    
    # Test collection access
    try:
        data_col = get_mongo_collection()
        registry_col = get_registry_collection()
        print(f"✓ Collections accessible: {data_col.name}, {registry_col.name}")
    except Exception as e:
        print(f"✗ Collection access failed: {e}")
        return False
    
    return True


def test_device_service():
    """Test DeviceService"""
    print("\n=== Testing DeviceService ===")
    
    from api.services import DeviceService
    
    # Test MAC normalization
    test_cases = [
        ("AA:BB:CC:DD:EE:FF", "AA:BB:CC:DD:EE:FF"),
        ("aa-bb-cc-dd-ee-ff", "AA:BB:CC:DD:EE:FF"),
        ("aabbccddeeff", "AA:BB:CC:DD:EE:FF"),
    ]
    
    for input_mac, expected in test_cases:
        result = DeviceService.normalize_mac_address(input_mac)
        assert result == expected, f"MAC normalization failed: {input_mac} -> {result} (expected {expected})"
    print("✓ MAC address normalization works")
    
    # Test device registration
    try:
        test_mac = "AA:BB:CC:DD:EE:FF"
        entry = DeviceService.register_device(test_mac, "test_device_001")
        assert entry is not None, "Device registration returned None"
        assert entry['mac_address'] == test_mac
        print(f"✓ Device registration works: {entry['display_name']}")
    except Exception as e:
        print(f"✗ Device registration failed: {e}")
        return False
    
    return True


def test_data_service():
    """Test DataService"""
    print("\n=== Testing DataService ===")
    
    from api.services import DataService
    
    # Test data normalization
    raw_data = {
        'timestamp': datetime.now(timezone.utc),
        'mac_address': 'AA:BB:CC:DD:EE:FF',
        'temperature': 22.5,
        'humidity': 45.0,
        'co2': 800
    }
    
    try:
        normalized = DataService.normalize_sensor_data(raw_data)
        assert 'temperature' in normalized
        assert 'humidity' in normalized
        assert 'co2' in normalized
        print("✓ Data normalization works")
    except Exception as e:
        print(f"✗ Data normalization failed: {e}")
        return False
    
    # Test validation
    is_valid, msg = DataService.validate_sensor_data(normalized)
    if is_valid:
        print(f"✓ Data validation works: {msg}")
    else:
        print(f"✗ Data validation failed: {msg}")
        return False
    
    # Test invalid data
    invalid_data = normalized.copy()
    invalid_data['co2'] = 10000  # Out of range
    is_valid, msg = DataService.validate_sensor_data(invalid_data)
    if not is_valid:
        print(f"✓ Invalid data rejected: {msg}")
    else:
        print("✗ Invalid data was accepted")
        return False
    
    return True


def test_auth_service():
    """Test AuthService"""
    print("\n=== Testing AuthService ===")
    
    from api.services import AuthService
    
    # Test API key generation
    api_key = AuthService.generate_api_key()
    assert len(api_key) == 32, f"API key length incorrect: {len(api_key)}"
    print(f"✓ API key generation works: {api_key[:8]}...")
    
    # Test hashing
    key_hash = AuthService.hash_api_key(api_key)
    assert len(key_hash) == 64, "Hash length incorrect"  # SHA256 = 64 hex chars
    print(f"✓ API key hashing works: {key_hash[:16]}...")
    
    # Test verification
    is_valid = AuthService.verify_api_key(api_key, key_hash)
    assert is_valid, "Valid key verification failed"
    print("✓ API key verification works (valid key)")
    
    is_valid = AuthService.verify_api_key("wrong_key", key_hash)
    assert not is_valid, "Invalid key was accepted"
    print("✓ API key verification works (invalid key rejected)")
    
    return True


def main():
    """Run all tests"""
    print("=" * 60)
    print("Phase 1 Verification - Database & Service Layer")
    print("=" * 60)
    
    results = {
        'Database Layer': test_db_layer(),
        'DeviceService': test_device_service(),
        'DataService': test_data_service(),
        'AuthService': test_auth_service(),
    }
    
    print("\n" + "=" * 60)
    print("Test Results:")
    print("=" * 60)
    
    for test_name, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{test_name:20s} {status}")
    
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
