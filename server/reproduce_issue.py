
import os
import sys
import django
import json

# Setup Django environment FIRST
sys.path.append('/home/matyaspopela/Repos/Cognitiv/server')
# Hack to prevent mqtt/scheduler from starting during reproduction script
if 'test' not in sys.argv:
    sys.argv.append('test')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cognitiv.settings')
django.setup()

# Import Django components AFTER django.setup()
from django.test import Client
from django.contrib.auth.models import User


def reproduce():
    client = Client()
    
    # ensure admin user exists
    username = 'admin_test'
    password = 'password123'
    email = 'admin@example.com'
    
    if not User.objects.filter(username=username).exists():
        User.objects.create_superuser(username, email, password)
        print(f"Created superuser: {username}")
    else:
        u = User.objects.get(username=username)
        u.set_password(password)
        u.save()
        print(f"Reset password for superuser: {username}")

    # Login
    print(f"Attempting login as {username}...")
    login_response = client.post('/api/admin/login', 
                               data=json.dumps({'username': username, 'password': password}),
                               content_type='application/json')
    
    print(f"Login Status: {login_response.status_code}")
    if login_response.status_code != 200:
        print(f"Login Failed!")
        print(f"Response content type: {login_response.get('Content-Type', 'unknown')}")
        try:
            # Try to parse as JSON first
            error_data = json.loads(login_response.content.decode())
            print(f"Error JSON: {json.dumps(error_data, indent=2)}")
        except:
            # If not JSON, show raw content
            print(f"Raw Response: {login_response.content.decode()[:500]}")
        return

    # Access protected endpoint
    print("Attempting to access /api/admin/devices...")
    try:
        devices_response = client.get('/api/admin/devices')
        print(f"Devices Status: {devices_response.status_code}")
        if devices_response.status_code == 500:
             print("FAILURE: Received 500 Internal Server Error (Expected)")
        elif devices_response.status_code == 200:
             print("SUCCESS: Received 200 OK")
        else:
             print(f"Unexpected status code: {devices_response.status_code}")
             print(f"Response: {devices_response.content.decode()}")

    except Exception as e:
        print(f"Exception during request: {e}")

if __name__ == '__main__':
    try:
        reproduce()
    except Exception as e:
        print(f"Script failed: {e}")
