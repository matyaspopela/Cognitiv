"""
Custom middleware to exempt API endpoints from CSRF protection.
IoT devices and API clients don't send CSRF tokens.
"""
from django.utils.deprecation import MiddlewareMixin


class DisableCSRFForAPI(MiddlewareMixin):
    """
    Disable CSRF protection for all /api/* endpoints.
    This is safe because:
    - API endpoints use @csrf_exempt decorator
    - IoT devices don't support CSRF tokens
    - API authentication can be handled via other means if needed
    """
    
    def process_request(self, request):
        # Skip CSRF check for all API endpoints
        if request.path.startswith('/api/'):
            setattr(request, '_dont_enforce_csrf_checks', True)
        return None






















