
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
    @patch('server.api.annotation.annotator.load_class_occupancy')
    def test_bucket_creation_includes_context(self, mock_load_occupancy, mock_room_manager_cls, mock_get_coll, mock_get_readings, mock_get_devices, mock_get_fetcher):
        # Setup mocks
        mock_collection = MagicMock()
        mock_get_coll.return_value = mock_collection
        
        # Occupancy Mock
        mock_load_occupancy.return_value = {'10.A': 28}
        
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
            'class_name': '10.A', # Added class name
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
        self.assertEqual(doc['context']['lesson']['estimated_occupancy'], 28) 
        self.assertEqual(doc['context']['lesson']['class_name'], '10.A') # Verify class name
        
        # Check Analysis
        self.assertIn('analysis', doc)
        # Ventilation score might be complex to calc, checking existence
        self.assertIn('ventilation_score', doc['analysis'])

    @patch('server.api.annotation.annotator.get_timetable_fetcher')
    @patch('server.api.annotation.annotator.get_devices_with_rooms')
    @patch('server.api.annotation.annotator.get_readings_for_date')
    @patch('server.api.annotation.annotator.get_annotated_readings_collection')
    @patch('server.api.annotation.annotator.RoomManager')
    @patch('server.api.annotation.annotator.load_class_occupancy')
    def test_split_class_occupancy_heuristic(self, mock_load_occupancy, mock_room_manager_cls, mock_get_coll, mock_get_readings, mock_get_devices, mock_get_fetcher):
        """Test that class names with spaces default to 15 occupancy."""
        # Setup mocks
        mock_collection = MagicMock()
        mock_get_coll.return_value = mock_collection
        
        # Occupancy Mock - "4.O sk1" is NOT in config
        mock_load_occupancy.return_value = {'10.A': 28}
        
        # Room Manager Mock
        mock_rm_instance = MagicMock()
        mock_room_manager_cls.return_value = mock_rm_instance
        mock_rm_instance.get_room.return_value = {}
        
        # Devices Mock
        mock_get_devices.return_value = [{
            'mac_address': 'AA:BB:CC',
            'room_code': 'b4',
            'display_name': 'Sensor 1'
        }]
        
        # Readings Mock
        mock_get_readings.return_value = [{
            'timestamp': datetime(2023, 10, 27, 8, 30, tzinfo=timezone.utc),
            'temperature': 20.0,
            'humidity': 50.0,
            'co2': 800
        }]
        
        # Fetcher Mock - Return split class name
        mock_fetcher = MagicMock()
        mock_get_fetcher.return_value = mock_fetcher
        mock_fetcher.get_lesson_at.return_value = {
            'subject': 'Math',
            'teacher': 'Smith',
            'class_name': '4.O sk1', # Contains space
            'lesson_number': 3,
            'is_lesson': True
        }
        
        # Run annotation
        annotate_day(date(2023, 10, 27))
        
        # Verify result
        args, kwargs = mock_collection.replace_one.call_args
        doc = args[1]
        
        self.assertEqual(doc['context']['lesson']['class_name'], '4.O sk1')
        self.assertEqual(doc['context']['lesson']['estimated_occupancy'], 15)

if __name__ == '__main__':
    unittest.main()
