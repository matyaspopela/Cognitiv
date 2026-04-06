from django.apps import AppConfig


class ApiConfig(AppConfig):
    name = 'api'
    
    def ready(self):
        """Called when Django is ready - start MQTT subscriber in background"""
        import sys
        import os
        
        # Skip during migrations, collectstatic, shell, etc.
        skip_commands = ['migrate', 'collectstatic', 'makemigrations', 'shell', 'createsuperuser', 'test']
        if any(cmd in sys.argv for cmd in skip_commands):
            return
        
        # Skip if we're not the main process when using runserver (avoid double-start with auto-reload)
        # RUN_MAIN is set by Django's runserver auto-reloader
        # Only check this for runserver, not for production servers like Gunicorn
        if 'runserver' in sys.argv and os.environ.get('RUN_MAIN') != 'true':
            return
            
        try:
            from api.mqtt_service import start_mqtt_subscriber
            start_mqtt_subscriber()
        except Exception as e:
            # Don't fail startup if MQTT fails
            print(f'Warning: Could not start MQTT subscriber: {e}')
        
        # Start annotation scheduler
        try:
            from api.annotation.scheduler import start_scheduler
            start_scheduler()
        except Exception as e:
            # Don't fail startup if scheduler fails
            print(f'Warning: Could not start annotation scheduler: {e}')