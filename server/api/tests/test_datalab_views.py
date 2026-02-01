
import unittest
import sys
import os
from unittest.mock import MagicMock, patch

# Add 'server' to path to allow importing board_manager
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from django.conf import settings
if not settings.configured:
    settings.configure(DEFAULT_CHARSET='utf-8')

from django.test import RequestFactory
# We will import datalab_export after setup to verify it exists
# form server.api.views import datalab_export 

class TestDataLabViews(unittest.TestCase):
    def setUp(self):
        self.factory = RequestFactory()

    @patch('server.api.views.ExportEngine')
    def test_export_endpoint_returns_streaming_response(self, mock_engine_cls):
        from server.api.views import datalab_export
        # Setup Mock
        mock_engine = MagicMock()
        mock_engine_cls.return_value = mock_engine
        mock_engine.export_stream.return_value = iter(["header\n", "row1\n"])
        
        # Request
        request = self.factory.get('/api/datalab/export?start=2023-10-27&end=2023-10-28&rooms=b4')
        
        # Call View
        response = datalab_export(request)
        
        # Verify
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.streaming)
        content = b"".join(response.streaming_content)
        self.assertEqual(content, b"header\nrow1\n")
        
        # Verify Engine called with correct args
        mock_engine.export_stream.assert_called()
        args, kwargs = mock_engine.export_stream.call_args
        filters = args[0]
        self.assertEqual(filters['start'], '2023-10-27')
        self.assertEqual(filters['rooms'], ['b4'])

if __name__ == '__main__':
    unittest.main()

