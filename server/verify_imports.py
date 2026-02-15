
import os
import sys
import django
from django.conf import settings

# Set up Django environment
sys.path.append('/home/matyaspopela/Repos/Cognitiv/server')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings')

try:
    from django.conf import settings
    if not settings.configured:
        django.setup()
        
    print("Django setup successful.")
    
    print("Importing api.views...")
    import api.views
    print("api.views imported successfully.")
    
    print("Importing api.urls...")
    import api.urls
    print("api.urls imported successfully.")
    
    print("Verification successful!")
    
except Exception as e:
    print(f"Verification failed: {e}")
    sys.exit(1)
