
import unittest
import json
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone
from django.test import RequestFactory
import sys
import os

# Add 'server' to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../')))

from django.conf import settings
if not settings.configured:
    settings.configure(
        DEFAULT_CHARSET='utf-8',
        SECRET_KEY='fake-key',
        INSTALLED_APPS=[
            'api',
        ],
    )
import django
django.setup()

from api.datalab.views import preview_query

class TestDataLabViews(unittest.TestCase):
    def setUp(self):
        self.factory = RequestFactory()

    @patch('api.datalab.views.get_annotated_readings_collection')
    def test_preview_query_returns_expected_fields(self, mock_get_coll):
        # Mock Data
        mock_doc = {
            'room_id': 'b4',
            'readings': {
                'ts': datetime(2023, 10, 27, 8, 0, tzinfo=timezone.utc),
                'co2': 400,
                'temp': 20.5,
                'humidity': 45.0,
                'subject': 'Math',
                'teacher': 'Smith',
                'class_name': '10A',
                'is_lesson': True
            },
            'context': {
                'lesson': {
                    'estimated_occupancy': 25
                }
            }
        }
        
        # Mock Collection
        mock_coll = MagicMock()
        mock_get_coll.return_value = mock_coll
        
        def mock_aggregate(pipeline):
            if any('$count' in stage for stage in pipeline):
                return [{'total': 1}]
            return [mock_doc]
            
        mock_coll.aggregate.side_effect = mock_aggregate
        
        # Request
        request_body = {
            'filters': {
                'start': '2023-10-27',
                'end': '2023-10-27',
                'rooms': ['b4']
            }
        }
        request = self.factory.post('/api/datalab/preview', 
                                    data=json.dumps(request_body),
                                    content_type='application/json')
        
        # Call View
        response = preview_query(request)
        
        # Verify
        if response.status_code != 200:
            print(f"Error: {response.content}")
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        
        self.assertIn('preview_data', data)
        preview = data['preview_data'][0]
        
        self.assertEqual(preview['subject'], 'Math')
        self.assertEqual(preview['teacher'], 'Smith')
        self.assertEqual(preview['class_name'], '10A')
        self.assertEqual(preview['occupancy'], 25)

if __name__ == '__main__':
    unittest.main()
