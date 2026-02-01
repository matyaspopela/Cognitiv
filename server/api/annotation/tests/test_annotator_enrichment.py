
import unittest
from unittest.mock import MagicMock, patch
from datetime import datetime, date, timezone
from server.api.annotation.annotator import annotate_day

class TestAnnotatorEnrichment(unittest.TestCase):
    
    @patch('server.api.annotation.annotator.get_timetable_fetcher')
    @patch('server.api.annotation.annotator.get_devices_with_rooms')
    @patch('server.api.annotation.annotator.get_readings_for_date')
    @patch('server.api.annotation.annotator.get_annotated_readings_collection')
    @patch('server.api.annotation.annotator.RoomManager')
    def test_bucket_creation_includes_context(self, mock_room_manager_cls, mock_get_coll, mock_get_readings, mock_get_devices, mock_get_fetcher):
        # Setup mocks
        mock_collection = MagicMock()
        mock_get_coll.return_value = mock_collection
        
        # Room Manager Mock
        mock_rm_instance = MagicMock()
        mock_room_manager_cls.return_value = mock_rm_instance
        mock_rm_instance.get_room.return_value = {
            '_id': 'b4',
            'label': 'Bio Lab',
            'volume_m3': 120.0
        }
        
        # Devices Mock
        mock_get_devices.return_value = [{
            'mac_address': 'AA:BB:CC',
            'room_code': 'b4',
            'display_name': 'Sensor 1'
        }]
        
        # Readings Mock
        ts = datetime(2023, 10, 27, 8, 30, tzinfo=timezone.utc)
        mock_get_readings.return_value = [{
            'timestamp': ts,
            'temperature': 20.0,
            'humidity': 50.0,
            'co2': 800
        }]
        
        # Fetcher Mock (Lesson present)
        mock_fetcher = MagicMock()
        mock_get_fetcher.return_value = mock_fetcher
        mock_fetcher.get_lesson_at.return_value = {
            'subject': 'Biology',
            'teacher': 'Novak',
            'lesson_number': 1,
            'is_lesson': True
        }
        
        # Run annotation
        target_date = date(2023, 10, 27)
        annotate_day(target_date)
        
        # Verify replace_one called with context
        mock_collection.replace_one.assert_called()
        args, kwargs = mock_collection.replace_one.call_args
        doc = args[1]
        
        # Assertions
        self.assertIn('context', doc)
        self.assertEqual(doc['context']['room']['label'], 'Bio Lab')
        self.assertEqual(doc['context']['room']['volume_m3'], 120.0)
        self.assertIn('lesson', doc['context'])
        self.assertEqual(doc['context']['lesson']['estimated_occupancy'], 25) # Default assumption
        
        # Check Analysis
        self.assertIn('analysis', doc)
        # Ventilation score might be complex to calc, checking existence
        self.assertIn('ventilation_score', doc['analysis'])

if __name__ == '__main__':
    unittest.main()
