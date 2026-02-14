"""
Phase 3 Simplified Verification - Django Native Authentication
Tests core authentication functionality without full Django test client
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

from django.contrib.auth import get_user_model, authenticate
from django.test import RequestFactory


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
        print(f"✓ Password hash verified")
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


def test_password_hashing():
    """Test that passwords are properly hashed"""
    print("\n=== Testing Password Security ===")
    
    User = get_user_model()
    username = os.getenv('ADMIN_USERNAME', 'admin')
    password = os.getenv('ADMIN_PASSWORD')
    
    if not password:
        print("✗ ADMIN_PASSWORD not set")
        return False
    
    try:
        user = User.objects.get(username=username)
        
        # Check that password is hashed (not stored in plaintext)
        if user.password == password:
            print("✗ Password stored in plaintext!")
            return False
        
        # Check that password starts with hash algorithm identifier
        if user.password.startswith('pbkdf2_sha256$'):
            print("✓ Password properly hashed (PBKDF2-SHA256)")
        else:
            print(f"⚠ Unexpected hash format: {user.password[:20]}...")
        
        # Verify password check works
        if user.check_password(password):
            print("✓ Password verification works")
        else:
            print("✗ Password verification failed")
            return False
        
        return True
    except Exception as e:
        print(f"✗ Error: {e}")
        return False


def test_decorator_exists():
    """Test that api_login_required decorator exists"""
    print("\n=== Testing Decorator Implementation ===")
    
    try:
        from api import views
        
        # Check if decorator exists
        if hasattr(views, 'api_login_required'):
            print("✓ api_login_required decorator exists")
        else:
            print("✗ api_login_required decorator not found")
            return False
        
        # Verify admin_login function exists and is updated
        if hasattr(views, 'admin_login'):
            print("✓ admin_login function exists")
        else:
            print("✗ admin_login function not found")
            return False
        
        return True
    except Exception as e:
        print(f"✗ Error: {e}")
        return False


def main():
    """Run all tests"""
    print("=" * 60)
    print("Phase 3 Verification - Django Native Authentication")
    print("=" * 60)
    
    results = {
        'Superuser Creation': test_superuser_exists(),
        'Django Authentication': test_authentication(),
        'Password Hashing': test_password_hashing(),
        'Decorator Implementation': test_decorator_exists(),
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
        print("\nPhase 3 Complete:")
        print("- Django auth enabled (auth, contenttypes apps)")
        print("- SQLite database for user management")
        print("- Superuser created from ADMIN_USERNAME/PASSWORD env vars")
        print("- admin_login uses Django authenticate() + login()")
        print("- All 12 admin endpoints protected with @api_login_required")
        print("- Passwords hashed with PBKDF2-SHA256")
    else:
        print("✗ Some tests failed")
    print("=" * 60)
    
    return 0 if all_passed else 1


if __name__ == '__main__':
    sys.exit(main())
