
import unittest
import sys
import os
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone

# Add 'server' to path to allow importing api package properly for tests
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../')))

# Now we can import from api...
from api.datalab.export_engine import ExportEngine

class TestExportEngine(unittest.TestCase):
    
    @patch('api.datalab.export_engine.get_annotated_readings_collection')
    @patch('api.datalab.export_engine.WeatherService')
    def test_export_csv_stream_yields_rows(self, mock_weather_cls, mock_get_coll):
        # Mock Data
        mock_data = [
            {
                'room_id': 'b4',
                'bucket_start': datetime(2023, 10, 27, 8, 0, tzinfo=timezone.utc),
                'readings': [
                    {'ts': datetime(2023, 10, 27, 8, 0, tzinfo=timezone.utc), 'co2': 400},
                    {'ts': datetime(2023, 10, 27, 8, 10, tzinfo=timezone.utc), 'co2': 420},
                ]
            }
        ]
        
        # Mock Cursor
        mock_cursor = MagicMock()
        mock_cursor.__iter__.return_value = iter(mock_data)
        
        # Mock Collection
        mock_coll = MagicMock()
        mock_get_coll.return_value = mock_coll
        # We use aggregate now
        mock_coll.aggregate.return_value = mock_cursor
        
        # Mock Weather
        mock_weather = MagicMock()
        mock_weather_cls.return_value = mock_weather
        mock_weather.get_weather_for_timestamp.return_value = {'temp_c': 15.0}
        
        engine = ExportEngine()
        filters = {'start': '2023-10-27', 'end': '2023-10-27'}
        
        # Execute
        stream = engine.export_stream(filters, format='csv')
        
        # Consume stream
        rows = list(stream)
        
        # Verify Data (should have 2 readings rows)
        full_output = b"".join(rows).decode('utf-8')
        
        # Verify Header
        self.assertIn('timestamp,room_id', full_output)
        self.assertIn('weather_temp_c', full_output)
        self.assertIn('subject,teacher,class_name,occupancy', full_output)
        
        self.assertIn("400", full_output)
        self.assertIn("15.0", full_output)

if __name__ == '__main__':
    unittest.main()
