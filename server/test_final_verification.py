"""
Final Verification Script - Backend Refactor Phases 1-4
Comprehensive end-to-end testing of all refactor phases
"""

import os
import sys

# Add server directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Django setup
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cognitiv.settings')
os.environ['DEVELOPMENT_DB'] = 'true'

import django
django.setup()

from django.contrib.auth import get_user_model
from api.database.mongo_manager import get_mongo_manager
from api.services.device_service import DeviceService
from api.services.data_service import DataService
from api.services.auth_service import AuthService


def test_phase1_database_layer():
    """Test Phase 1: Database Layer"""
    print("\n" + "="*60)
    print("Phase 1: Database Layer")
    print("="*60)
    
    try:
        # Test MongoManager singleton
        manager1 = get_mongo_manager()
        manager2 = get_mongo_manager()
        assert manager1 is manager2, "MongoManager is not a singleton"
        print("✓ MongoManager singleton pattern works")
        
        # Test database connection
        db = manager1.get_database()
        assert db is not None, "Database connection failed"
        print("✓ Database connection established")
        
        # Test collections exist
        collections = db.list_collection_names()
        required = ['sensor_data', 'device_registry']
        for coll in required:
            assert coll in collections, f"Collection {coll} missing"
        print(f"✓ Required collections exist: {', '.join(required)}")
        
        return True
    except Exception as e:
        print(f"✗ Phase 1 failed: {e}")
        return False


def test_phase1_service_layer():
    """Test Phase 1: Service Layer"""
    print("\n" + "="*60)
    print("Phase 1: Service Layer")
    print("="*60)
    
    try:
        # Test DeviceService
        device_service = DeviceService()
        assert hasattr(device_service, 'register_device'), "DeviceService missing register_device"
        assert hasattr(device_service, 'normalize_mac'), "DeviceService missing normalize_mac"
        print("✓ DeviceService initialized with required methods")
        
        # Test DataService
        data_service = DataService()
        assert hasattr(data_service, 'ingest_reading'), "DataService missing ingest_reading"
        print("✓ DataService initialized with required methods")
        
        # Test AuthService
        auth_service = AuthService()
        assert hasattr(auth_service, 'generate_api_key'), "AuthService missing generate_api_key"
        print("✓ AuthService initialized with required methods")
        
        # Test MAC normalization
        mac = device_service.normalize_mac("aa:bb:cc:dd:ee:ff")
        assert mac == "AA:BB:CC:DD:EE:FF", "MAC normalization failed"
        print("✓ MAC address normalization works")
        
        return True
    except Exception as e:
        print(f"✗ Phase 1 Service Layer failed: {e}")
        return False


def test_phase2_pydantic_schemas():
    """Test Phase 2: Pydantic Validation"""
    print("\n" + "="*60)
    print("Phase 2: Pydantic Validation")
    print("="*60)
    
    try:
        from api.schemas import SensorDataSchema
        
        # Test valid data
        valid_data = {
            'mac_address': 'aa:bb:cc:dd:ee:ff',
            'co2': 450,
            'temperature': 22.5,
            'humidity': 45.0,
            'timestamp': '2024-01-01T12:00:00Z'
        }
        schema = SensorDataSchema(**valid_data)
        assert schema.mac_address == 'AA:BB:CC:DD:EE:FF', "MAC not normalized"
        print("✓ Pydantic schema validates and normalizes data")
        
        # Test invalid data
        try:
            invalid_data = {'mac_address': 'invalid', 'co2': 'not_a_number'}
            SensorDataSchema(**invalid_data)
            print("✗ Pydantic should reject invalid data")
            return False
        except Exception:
            print("✓ Pydantic rejects invalid data")
        
        return True
    except Exception as e:
        print(f"✗ Phase 2 Pydantic failed: {e}")
        return False


def test_phase2_api_key_auth():
    """Test Phase 2: API Key Authentication"""
    print("\n" + "="*60)
    print("Phase 2: API Key Authentication")
    print("="*60)
    
    try:
        auth_service = AuthService()
        
        # Test API key generation
        api_key = auth_service.generate_api_key()
        assert len(api_key) == 64, "API key wrong length"
        print(f"✓ API key generated: {api_key[:16]}...")
        
        # Test key hashing
        key_hash = auth_service.hash_api_key(api_key)
        assert key_hash.startswith('sha256:'), "Hash format incorrect"
        print("✓ API key hashing works (SHA256)")
        
        # Test key verification
        assert auth_service.verify_api_key(api_key, key_hash), "Key verification failed"
        print("✓ API key verification works")
        
        return True
    except Exception as e:
        print(f"✗ Phase 2 API Key Auth failed: {e}")
        return False


def test_phase3_django_auth():
    """Test Phase 3: Django Authentication"""
    print("\n" + "="*60)
    print("Phase 3: Django Authentication")
    print("="*60)
    
    try:
        User = get_user_model()
        username = os.getenv('ADMIN_USERNAME', 'admin')
        
        # Test superuser exists
        user = User.objects.get(username=username)
        assert user.is_staff, "User not staff"
        assert user.is_superuser, "User not superuser"
        print(f"✓ Superuser exists: {username}")
        
        # Test password hashing
        assert user.password.startswith('pbkdf2_sha256$'), "Password not hashed"
        print("✓ Password properly hashed (PBKDF2-SHA256)")
        
        # Test decorator exists
        from api import views
        assert hasattr(views, 'api_login_required'), "Decorator missing"
        print("✓ @api_login_required decorator exists")
        
        return True
    except Exception as e:
        print(f"✗ Phase 3 Django Auth failed: {e}")
        return False


def test_phase4_code_quality():
    """Test Phase 4: Code Quality"""
    print("\n" + "="*60)
    print("Phase 4: Code Quality")
    print("="*60)
    
    try:
        from api import views
        
        # Test typing imports exist
        import inspect
        source = inspect.getsource(views)
        assert 'from typing import' in source, "Typing imports missing"
        print("✓ Type hints imports added")
        
        # Test deprecated functions removed
        deprecated = [
            'normalize_mac_address',
            'normalize_sensor_data',
            'validate_sensor_data',
            'ensure_registry_entry'
        ]
        for func in deprecated:
            assert not hasattr(views, func), f"Deprecated function {func} still exists"
        print(f"✓ All deprecated functions removed ({len(deprecated)} checked)")
        
        return True
    except Exception as e:
        print(f"✗ Phase 4 Code Quality failed: {e}")
        return False


def main():
    """Run all verification tests"""
    print("="*60)
    print("FINAL VERIFICATION - Backend Refactor Phases 1-4")
    print("="*60)
    
    results = {
        'Phase 1: Database Layer': test_phase1_database_layer(),
        'Phase 1: Service Layer': test_phase1_service_layer(),
        'Phase 2: Pydantic Schemas': test_phase2_pydantic_schemas(),
        'Phase 2: API Key Auth': test_phase2_api_key_auth(),
        'Phase 3: Django Auth': test_phase3_django_auth(),
        'Phase 4: Code Quality': test_phase4_code_quality(),
    }
    
    print("\n" + "="*60)
    print("FINAL RESULTS")
    print("="*60)
    
    for test_name, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{test_name:35s} {status}")
    
    all_passed = all(results.values())
    print("\n" + "="*60)
    if all_passed:
        print("✓✓✓ ALL PHASES VERIFIED SUCCESSFULLY ✓✓✓")
        print("\nBackend Refactor Complete:")
        print("- Phase 1: Database & Service Layer ✓")
        print("- Phase 2: Security Hardening ✓")
        print("- Phase 3: Django Native Auth ✓")
        print("- Phase 4: Code Cleanup ✓")
    else:
        print("✗ Some tests failed - review output above")
    print("="*60)
    
    return 0 if all_passed else 1


if __name__ == '__main__':
    sys.exit(main())
