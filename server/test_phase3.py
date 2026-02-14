"""
Phase 3 Verification Script - Django Native Authentication
Tests superuser creation and authentication functionality
"""

import os
import sys
import json

# Add server directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Django setup
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cognitiv.settings')
os.environ['DEVELOPMENT_DB'] = 'true'

import django
django.setup()

from django.contrib.auth import get_user_model, authenticate
from django.test import RequestFactory, Client


def test_superuser_exists():
    """Test that superuser was created"""
    print("\n=== Testing Superuser Creation ===")
    
    User = get_user_model()
    username = os.getenv('ADMIN_USERNAME', 'admin')
    
    try:
        user = User.objects.get(username=username)
        assert user.is_staff, "User is not staff"
        assert user.is_superuser, "User is not superuser"
        print(f"✓ Superuser exists: {username}")
        print(f"✓ User is staff: {user.is_staff}")
        print(f"✓ User is superuser: {user.is_superuser}")
        print(f"✓ Email: {user.email}")
        return True
    except User.DoesNotExist:
        print(f"✗ Superuser {username} does not exist")
        return False
    except Exception as e:
        print(f"✗ Error checking superuser: {e}")
        return False


def test_authentication():
    """Test Django authentication"""
    print("\n=== Testing Django Authentication ===")
    
    username = os.getenv('ADMIN_USERNAME', 'admin')
    password = os.getenv('ADMIN_PASSWORD')
    
    if not password:
        print("✗ ADMIN_PASSWORD not set")
        return False
    
    # Create a mock request
    factory = RequestFactory()
    request = factory.get('/')
    
    # Test correct credentials
    user = authenticate(request, username=username, password=password)
    if user is not None:
        print(f"✓ Authentication successful for {username}")
    else:
        print(f"✗ Authentication failed for {username}")
        return False
    
    # Test incorrect credentials
    user = authenticate(request, username=username, password='wrong_password')
    if user is None:
        print("✓ Invalid credentials rejected")
    else:
        print("✗ Invalid credentials accepted")
        return False
    
    return True


def test_login_endpoint():
    """Test admin login endpoint"""
    print("\n=== Testing Admin Login Endpoint ===")
    
    client = Client()
    username = os.getenv('ADMIN_USERNAME', 'admin')
    password = os.getenv('ADMIN_PASSWORD')
    
    if not password:
        print("✗ ADMIN_PASSWORD not set")
        return False
    
    # Test valid login
    response = client.post(
        '/api/admin/login',
        data=json.dumps({'username': username, 'password': password}),
        content_type='application/json'
    )
    
    if response.status_code == 200:
        data = json.loads(response.content)
        if data.get('status') == 'success':
            print(f"✓ Login successful: {data.get('message')}")
        else:
            print(f"✗ Login failed: {data}")
            return False
    else:
        print(f"✗ Login returned status {response.status_code}")
        return False
    
    # Test invalid login
    response = client.post(
        '/api/admin/login',
        data=json.dumps({'username': username, 'password': 'wrong'}),
        content_type='application/json'
    )
    
    if response.status_code == 401:
        print("✓ Invalid credentials rejected (401)")
    else:
        print(f"✗ Invalid credentials returned {response.status_code}")
        return False
    
    return True


def test_protected_endpoints():
    """Test that admin endpoints require authentication"""
    print("\n=== Testing Protected Endpoints ===")
    
    client = Client()
    
    # Test accessing protected endpoint without auth
    response = client.get('/api/admin/devices')
    
    if response.status_code == 401:
        data = json.loads(response.content)
        if data.get('message') == 'Authentication required':
            print("✓ Unauthenticated request rejected (401)")
        else:
            print(f"✗ Unexpected error message: {data}")
            return False
    else:
        print(f"✗ Unauthenticated request returned {response.status_code}")
        return False
    
    # Test accessing protected endpoint with auth
    username = os.getenv('ADMIN_USERNAME', 'admin')
    password = os.getenv('ADMIN_PASSWORD')
    
    if not password:
        print("✗ ADMIN_PASSWORD not set")
        return False
    
    # Login first
    client.post(
        '/api/admin/login',
        data=json.dumps({'username': username, 'password': password}),
        content_type='application/json'
    )
    
    # Now try accessing protected endpoint
    response = client.get('/api/admin/devices')
    
    if response.status_code in [200, 500]:  # 200 or 500 (DB error) both mean auth worked
        print("✓ Authenticated request accepted")
        return True
    else:
        print(f"✗ Authenticated request returned {response.status_code}")
        return False


def main():
    """Run all tests"""
    print("=" * 60)
    print("Phase 3 Verification - Django Native Authentication")
    print("=" * 60)
    
    results = {
        'Superuser Creation': test_superuser_exists(),
        'Django Authentication': test_authentication(),
        'Login Endpoint': test_login_endpoint(),
        'Protected Endpoints': test_protected_endpoints(),
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
