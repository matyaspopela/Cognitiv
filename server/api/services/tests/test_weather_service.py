
import unittest
from unittest.mock import MagicMock, patch
from datetime import date, datetime, timezone
from server.api.services.weather_service import WeatherService

class TestWeatherService(unittest.TestCase):
    
    @patch('server.api.services.weather_service.MongoClient')
    def setUp(self, mock_client):
        # Reset Singleton if implemented (good practice from previous step)
        if hasattr(WeatherService, '_instance'):
             WeatherService._instance = None
             
        self.mock_client = mock_client
        self.mock_db = MagicMock()
        self.mock_collection = MagicMock()
        
        self.mock_client.return_value = MagicMock()
        self.mock_client.return_value.__getitem__.return_value = self.mock_db
        self.mock_db.__getitem__.return_value = self.mock_collection
        
        self.service = WeatherService()
        # Inject mock collection
        self.service._collection = self.mock_collection

    @patch('server.api.services.weather_service.requests')
    def test_fetch_historical_weather_calls_api(self, mock_requests):
        """Test that fetch calls Open-Meteo API and saves data."""
        # Mock API response
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "hourly": {
                "time": ["2023-10-27T00:00", "2023-10-27T01:00"],
                "temperature_2m": [10.5, 11.2],
                "relative_humidity_2m": [80, 75],
                "weather_code": [3, 1]
            }
        }
        mock_requests.get.return_value = mock_response
        
        start = date(2023, 10, 27)
        end = date(2023, 10, 27)
        
        count = self.service.fetch_historical_weather(start, end)
        
        self.assertEqual(count, 2)
        # Verify API called with correct params
        mock_requests.get.assert_called_once()
        args, kwargs = mock_requests.get.call_args
        self.assertIn('archive-api.open-meteo.com', args[0])
        self.assertEqual(kwargs['params']['start_date'], '2023-10-27')
        
        # Verify DB insertion (2 upserts)
        self.assertEqual(self.mock_collection.replace_one.call_count, 2)

    def test_get_weather_retrieves_from_db(self):
        """Test retrieval of weather data for a specific timestamp."""
        ts = datetime(2023, 10, 27, 10, 0, tzinfo=timezone.utc)
        mock_doc = {
            'timestamp': ts,
            'temp_c': 15.0
        }
        self.mock_collection.find_one.return_value = mock_doc
        
        result = self.service.get_weather_for_timestamp(ts)
        self.assertEqual(result, mock_doc)
        # Should query by timestamp rounded to hour? Spec says aligned to :00
        # We'll check implementation details later.

if __name__ == '__main__':
    unittest.main()
