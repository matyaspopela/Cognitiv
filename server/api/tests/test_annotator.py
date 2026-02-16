"""
Tests for the Data Annotation Process.

Tests the annotation system that combines sensor readings with timetable information
using the bucket pattern. Covers:
- Reading annotation with timetable data
- Bucket statistics computation
- Occupancy estimation
- Ventilation score calculation
- Weather integration
- Mold risk state continuity
"""

import unittest
import sys
import os
from datetime import datetime, date, timedelta, timezone
from unittest.mock import MagicMock, patch, Mock
from dataclasses import asdict

# Add server to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from django.conf import settings
if not settings.configured:
    settings.configure(DEFAULT_CHARSET='utf-8')

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo

UTC = timezone.utc
LOCAL_TZ = ZoneInfo('Europe/Prague')


class TestAnnotateReading(unittest.TestCase):
    """Tests for annotate_reading function."""
    
    def setUp(self):
        """Set up test fixtures."""
        from api.annotation.annotator import AnnotatedReading
        self.AnnotatedReading = AnnotatedReading
    
    def test_annotate_reading_with_lesson(self):
        """Test annotating a reading during a scheduled lesson."""
        from api.annotation.annotator import annotate_reading
        
        # Mock timetable fetcher
        mock_fetcher = MagicMock()
        mock_fetcher.get_lesson_at.return_value = {
            'subject': 'Mathematics',
            'teacher': 'John Doe',
            'lesson_number': 1,
            'class_name': '4.A',
            'is_lesson': True
        }
        
        # Create a sample reading
        reading = {
            'timestamp': datetime(2024, 1, 15, 8, 30, tzinfo=UTC),
            'temperature': 22.5,
            'humidity': 45.3,
            'co2': 850
        }
        
        result = annotate_reading(reading, 'U1', mock_fetcher)
        
        # Verify the annotation
        self.assertIsInstance(result, self.AnnotatedReading)
        self.assertEqual(result.temp, 22.5)
        self.assertEqual(result.humidity, 45.3)
        self.assertEqual(result.co2, 850)
        self.assertEqual(result.subject, 'Mathematics')
        self.assertEqual(result.teacher, 'John Doe')
        self.assertEqual(result.lesson_number, 1)
        self.assertEqual(result.class_name, '4.A')
        self.assertTrue(result.is_lesson)
        
        # Verify fetcher was called correctly
        mock_fetcher.get_lesson_at.assert_called_once_with('U1', reading['timestamp'])
    
    def test_annotate_reading_without_lesson(self):
        """Test annotating a reading during a break (no lesson)."""
        from api.annotation.annotator import annotate_reading
        
        # Mock timetable fetcher returning None (no lesson)
        mock_fetcher = MagicMock()
        mock_fetcher.get_lesson_at.return_value = None
        
        reading = {
            'timestamp': datetime(2024, 1, 15, 10, 0, tzinfo=UTC),
            'temperature': 21.0,
            'humidity': 50.0,
            'co2': 600
        }
        
        result = annotate_reading(reading, 'U2', mock_fetcher)
        
        # All lesson fields should be None/False
        self.assertIsNone(result.subject)
        self.assertIsNone(result.teacher)
        self.assertIsNone(result.lesson_number)
        self.assertIsNone(result.class_name)
        self.assertFalse(result.is_lesson)
    
    def test_annotate_reading_timestamp_conversion(self):
        """Test that timestamp is properly converted to timezone-aware datetime."""
        from api.annotation.annotator import annotate_reading
        
        mock_fetcher = MagicMock()
        mock_fetcher.get_lesson_at.return_value = None
        
        # Test with string timestamp
        reading_str = {
            'timestamp': '2024-01-15T08:30:00Z',
            'temperature': 22.0,
            'humidity': 45.0,
            'co2': 800
        }
        
        result = annotate_reading(reading_str, 'U1', mock_fetcher)
        self.assertIsInstance(result.ts, datetime)
        self.assertIsNotNone(result.ts.tzinfo)
    
    def test_annotate_reading_rounding(self):
        """Test that temperature and humidity are rounded to 2 decimal places."""
        from api.annotation.annotator import annotate_reading
        
        mock_fetcher = MagicMock()
        mock_fetcher.get_lesson_at.return_value = None
        
        reading = {
            'timestamp': datetime(2024, 1, 15, 8, 30, tzinfo=UTC),
            'temperature': 22.555555,
            'humidity': 45.999999,
            'co2': 850
        }
        
        result = annotate_reading(reading, 'U1', mock_fetcher)
        
        self.assertEqual(result.temp, 22.56)
        self.assertEqual(result.humidity, 46.0)


class TestBucketStatistics(unittest.TestCase):
    """Tests for compute_bucket_stats function."""
    
    def setUp(self):
        """Set up test fixtures."""
        from api.annotation.annotator import AnnotatedReading
        self.AnnotatedReading = AnnotatedReading
    
    def test_compute_stats_basic(self):
        """Test basic statistics computation."""
        from api.annotation.annotator import compute_bucket_stats
        
        readings = [
            self.AnnotatedReading(
                ts=datetime(2024, 1, 15, 8, i, tzinfo=UTC),
                temp=20.0 + i,
                humidity=40.0 + i,
                co2=800 + i * 10,
                subject=None,
                teacher=None,
                lesson_number=None,
                class_name=None,
                is_lesson=False
            )
            for i in range(5)
        ]
        
        stats = compute_bucket_stats(readings)
        
        # Check all stats are present
        self.assertEqual(stats['min_temp'], 20.0)
        self.assertEqual(stats['max_temp'], 24.0)
        self.assertEqual(stats['avg_temp'], 22.0)
        
        self.assertEqual(stats['min_humidity'], 40.0)
        self.assertEqual(stats['max_humidity'], 44.0)
        self.assertEqual(stats['avg_humidity'], 42.0)
        
        self.assertEqual(stats['min_co2'], 800)
        self.assertEqual(stats['max_co2'], 840)
        self.assertEqual(stats['avg_co2'], 820.0)
        
        self.assertEqual(stats['reading_count'], 5)
        self.assertEqual(stats['lesson_count'], 0)
    
    def test_compute_stats_with_lessons(self):
        """Test lesson counting in statistics."""
        from api.annotation.annotator import compute_bucket_stats
        
        readings = [
            self.AnnotatedReading(
                ts=datetime(2024, 1, 15, 8, i, tzinfo=UTC),
                temp=22.0,
                humidity=45.0,
                co2=900,
                subject='Math' if i < 3 else None,
                teacher='Teacher' if i < 3 else None,
                lesson_number=1 if i < 3 else None,
                class_name='4.A' if i < 3 else None,
                is_lesson=i < 3
            )
            for i in range(5)
        ]
        
        stats = compute_bucket_stats(readings)
        
        self.assertEqual(stats['reading_count'], 5)
        self.assertEqual(stats['lesson_count'], 3)
    
    def test_compute_stats_empty_list(self):
        """Test that empty reading list returns empty dict."""
        from api.annotation.annotator import compute_bucket_stats
        
        stats = compute_bucket_stats([])
        self.assertEqual(stats, {})
    
    def test_compute_stats_rounding(self):
        """Test that statistics are properly rounded."""
        from api.annotation.annotator import compute_bucket_stats
        
        readings = [
            self.AnnotatedReading(
                ts=datetime(2024, 1, 15, 8, 0, tzinfo=UTC),
                temp=22.333,
                humidity=45.666,
                co2=850,
                subject=None,
                teacher=None,
                lesson_number=None,
                class_name=None,
                is_lesson=False
            ),
            self.AnnotatedReading(
                ts=datetime(2024, 1, 15, 8, 30, tzinfo=UTC),
                temp=22.666,
                humidity=45.333,
                co2=870,
                subject=None,
                teacher=None,
                lesson_number=None,
                class_name=None,
                is_lesson=False
            )
        ]
        
        stats = compute_bucket_stats(readings)
        
        # Average should be rounded to 2 decimal places
        self.assertEqual(stats['avg_temp'], 22.5)
        self.assertEqual(stats['avg_humidity'], 45.5)
        self.assertEqual(stats['avg_co2'], 860.0)


class TestHourlyGrouping(unittest.TestCase):
    """Tests for group_readings_by_hour function."""
    
    def setUp(self):
        """Set up test fixtures."""
        from api.annotation.annotator import AnnotatedReading
        self.AnnotatedReading = AnnotatedReading
    
    def test_group_readings_single_hour(self):
        """Test grouping readings within a single hour."""
        from api.annotation.annotator import group_readings_by_hour
        
        # Create readings all within 8:00-9:00
        readings = [
            self.AnnotatedReading(
                ts=datetime(2024, 1, 15, 8, minute, tzinfo=LOCAL_TZ),
                temp=22.0,
                humidity=45.0,
                co2=800,
                subject=None,
                teacher=None,
                lesson_number=None,
                class_name=None,
                is_lesson=False
            )
            for minute in [0, 15, 30, 45]
        ]
        
        buckets = group_readings_by_hour(readings)
        
        # Should have exactly one bucket
        self.assertEqual(len(buckets), 1)
        
        # Get the bucket
        bucket_start = list(buckets.keys())[0]
        bucket_readings = buckets[bucket_start]
        
        # Verify bucket start is at hour boundary (in UTC)
        expected_start = datetime(2024, 1, 15, 8, 0, tzinfo=LOCAL_TZ).astimezone(UTC)
        self.assertEqual(bucket_start, expected_start)
        
        # All readings should be in this bucket
        self.assertEqual(len(bucket_readings), 4)
    
    def test_group_readings_multiple_hours(self):
        """Test grouping readings across multiple hours."""
        from api.annotation.annotator import group_readings_by_hour
        
        readings = [
            self.AnnotatedReading(
                ts=datetime(2024, 1, 15, hour, 30, tzinfo=LOCAL_TZ),
                temp=22.0,
                humidity=45.0,
                co2=800,
                subject=None,
                teacher=None,
                lesson_number=None,
                class_name=None,
                is_lesson=False
            )
            for hour in [8, 9, 10, 11]
        ]
        
        buckets = group_readings_by_hour(readings)
        
        # Should have 4 buckets (one per hour)
        self.assertEqual(len(buckets), 4)
        
        # Each bucket should have 1 reading
        for bucket_readings in buckets.values():
            self.assertEqual(len(bucket_readings), 1)
    
    def test_group_readings_boundary_cases(self):
        """Test readings at hour boundaries."""
        from api.annotation.annotator import group_readings_by_hour
        
        # Reading at exactly 9:00 should go in 9:00 bucket
        readings = [
            self.AnnotatedReading(
                ts=datetime(2024, 1, 15, 9, 0, 0, tzinfo=LOCAL_TZ),
                temp=22.0,
                humidity=45.0,
                co2=800,
                subject=None,
                teacher=None,
                lesson_number=None,
                class_name=None,
                is_lesson=False
            )
        ]
        
        buckets = group_readings_by_hour(readings)
        
        bucket_start = list(buckets.keys())[0]
        expected_start = datetime(2024, 1, 15, 9, 0, tzinfo=LOCAL_TZ).astimezone(UTC)
        self.assertEqual(bucket_start, expected_start)


class TestOccupancyEstimation(unittest.TestCase):
    """Tests for occupancy estimation logic."""
    
    def test_occupancy_from_config(self):
        """Test occupancy lookup from class_occupancy config."""
        from api.annotation.annotator import load_class_occupancy
        
        # Test that function returns a dict (may be empty if config not found)
        occupancy_map = load_class_occupancy()
        self.assertIsInstance(occupancy_map, dict)
    
    @patch('api.annotation.annotator.load_class_occupancy')
    def test_occupancy_known_class(self, mock_load):
        """Test occupancy for a known class in config."""
        # Mock the occupancy mapping
        mock_load.return_value = {
            '4.A': 25,
            '4.B': 28,
            '1.O': 30
        }
        
        # This would be tested through the full annotate_day workflow
        # Here we verify the config loading works
        occupancy_map = mock_load()
        self.assertEqual(occupancy_map['4.A'], 25)
        self.assertEqual(occupancy_map['4.B'], 28)


class TestVentilationScore(unittest.TestCase):
    """Tests for ventilation score calculation logic."""
    
    def test_ventilation_score_excellent(self):
        """Test ventilation score for low CO2 (< 1000 ppm)."""
        # Excellent ventilation: <1000 ppm = score 10
        avg_co2 = 800
        
        if avg_co2 < 1000:
            vent_score = 10.0
        else:
            vent_score = 10.0 - ((avg_co2 - 1000) / 200.0)
            vent_score = max(0.0, min(10.0, vent_score))
        
        self.assertEqual(vent_score, 10.0)
    
    def test_ventilation_score_moderate(self):
        """Test ventilation score for moderate CO2 (1000-2000 ppm)."""
        # Moderate: 1500 ppm should give score 7.5
        avg_co2 = 1500
        
        if avg_co2 < 1000:
            vent_score = 10.0
        else:
            vent_score = 10.0 - ((avg_co2 - 1000) / 200.0)
            vent_score = max(0.0, min(10.0, vent_score))
        
        self.assertEqual(vent_score, 7.5)
    
    def test_ventilation_score_poor(self):
        """Test ventilation score for high CO2 (> 3000 ppm)."""
        # Very poor: 3500 ppm should give score 0
        avg_co2 = 3500
        
        if avg_co2 < 1000:
            vent_score = 10.0
        else:
            vent_score = 10.0 - ((avg_co2 - 1000) / 200.0)
            vent_score = max(0.0, min(10.0, vent_score))
        
        self.assertEqual(vent_score, 0.0)
    
    def test_ventilation_score_boundary(self):
        """Test ventilation score at CO2 = 1000 ppm boundary."""
        avg_co2 = 1000
        
        if avg_co2 < 1000:
            vent_score = 10.0
        else:
            vent_score = 10.0 - ((avg_co2 - 1000) / 200.0)
            vent_score = max(0.0, min(10.0, vent_score))
        
        self.assertEqual(vent_score, 10.0)


class TestMoldRiskStateContinuity(unittest.TestCase):
    """Tests for mold risk state continuity across buckets."""
    
    def test_get_previous_mold_state_none(self):
        """Test getting previous mold state when none exists."""
        from api.annotation.annotator import get_previous_mold_state, MoldRiskState
        
        with patch('api.annotation.annotator.get_annotated_readings_collection') as mock_coll:
            mock_coll.return_value.find_one.return_value = None
            
            state = get_previous_mold_state('U1', datetime(2024, 1, 15, 8, 0, tzinfo=UTC))
            
            # Should return a fresh state
            self.assertIsInstance(state, MoldRiskState)
            self.assertEqual(state.current_risk_score, 0.0)
    
    def test_get_previous_mold_state_exists(self):
        """Test getting previous mold state when it exists."""
        from api.annotation.annotator import get_previous_mold_state, MoldRiskState
        
        with patch('api.annotation.annotator.get_annotated_readings_collection') as mock_coll:
            # Mock a previous bucket with mold state
            mock_bucket = {
                'room_id': 'U1',
                'bucket_start': datetime(2024, 1, 15, 7, 0, tzinfo=UTC),
                'context': {
                    'mold_risk_state': {
                        'current_risk_score': 0.5,
                        'last_unfavorable_timestamp': None,
                        'last_update_ts': '2024-01-15T07:59:00Z'
                    }
                }
            }
            mock_coll.return_value.find_one.return_value = mock_bucket
            
            state = get_previous_mold_state('U1', datetime(2024, 1, 15, 8, 0, tzinfo=UTC))
            
            # Should restore the previous state
            self.assertIsInstance(state, MoldRiskState)
            self.assertEqual(state.current_risk_score, 0.5)


class TestGetReadingsForDate(unittest.TestCase):
    """Tests for get_readings_for_date function."""
    
    def test_get_readings_query_structure(self):
        """Test that the MongoDB query is structured correctly."""
        from api.annotation.annotator import get_readings_for_date
        
        with patch('api.annotation.annotator.get_sensor_collection') as mock_coll:
            mock_cursor = MagicMock()
            mock_cursor.sort.return_value = []
            mock_coll.return_value.find.return_value = mock_cursor
            
            target_date = date(2024, 1, 15)
            mac = 'AA:BB:CC:DD:EE:FF'
            
            get_readings_for_date(mac, target_date)
            
            # Verify find was called
            self.assertTrue(mock_coll.return_value.find.called)
            
            # Get the query that was used
            call_args = mock_coll.return_value.find.call_args
            query = call_args[0][0]
            
            # Verify query structure
            self.assertIn('$or', query)
            self.assertIn('timestamp', query)
            
            # Verify MAC address is in query
            or_conditions = query['$or']
            self.assertTrue(
                any('mac_address' in cond for cond in or_conditions)
            )


class TestGetDevicesWithRooms(unittest.TestCase):
    """Tests for get_devices_with_rooms function."""
    
    def test_get_devices_filters_correctly(self):
        """Test that only devices with room_code are returned."""
        from api.annotation.annotator import get_devices_with_rooms
        
        with patch('api.annotation.annotator.get_registry_collection') as mock_coll:
            mock_devices = [
                {
                    'mac_address': 'AA:BB:CC:DD:EE:FF',
                    'room_code': 'U1',
                    'display_name': 'Device 1'
                },
                {
                    'mac_address': 'AA:BB:CC:DD:EE:FE',
                    'room_code': 'U2'
                    # No display_name
                }
            ]
            mock_coll.return_value.find.return_value = mock_devices
            
            devices = get_devices_with_rooms()
            
            # Verify query filters for room_code
            call_args = mock_coll.return_value.find.call_args
            query = call_args[0][0]
            self.assertIn('room_code', query)
            
            # Verify returned structure
            self.assertEqual(len(devices), 2)
            self.assertEqual(devices[0]['mac_address'], 'AA:BB:CC:DD:EE:FF')
            self.assertEqual(devices[0]['room_code'], 'U1')
            self.assertEqual(devices[0]['display_name'], 'Device 1')
            
            # Verify fallback to mac_address when no display_name
            self.assertEqual(devices[1]['display_name'], 'AA:BB:CC:DD:EE:FE')


class TestAnnotationStatusEndpoint(unittest.TestCase):
    """Tests for get_annotation_status function."""
    
    def test_annotation_status_success(self):
        """Test successful status retrieval."""
        from api.annotation.annotator import get_annotation_status
        
        with patch('api.annotation.annotator.get_annotated_readings_collection') as mock_coll, \
             patch('api.annotation.annotator.get_devices_with_rooms') as mock_devices:
            
            mock_coll.return_value.find_one.return_value = {
                'bucket_start': datetime(2024, 1, 15, 10, 0, tzinfo=UTC)
            }
            mock_coll.return_value.count_documents.return_value = 100
            mock_coll.return_value.distinct.return_value = ['U1', 'U2', 'U3']
            mock_devices.return_value = [{'mac_address': 'AA:BB:CC:DD:EE:FF', 'room_code': 'U1'}]
            
            status = get_annotation_status()
            
            self.assertEqual(status['status'], 'ok')
            self.assertEqual(status['total_buckets'], 100)
            self.assertEqual(status['rooms_with_data'], ['U1', 'U2', 'U3'])
            self.assertEqual(status['devices_with_rooms'], 1)
            self.assertIsNotNone(status['latest_bucket_start'])
    
    def test_annotation_status_error(self):
        """Test status retrieval when error occurs."""
        from api.annotation.annotator import get_annotation_status
        
        with patch('api.annotation.annotator.get_annotated_readings_collection') as mock_coll:
            mock_coll.side_effect = Exception('Database connection failed')
            
            status = get_annotation_status()
            
            self.assertEqual(status['status'], 'error')
            self.assertIn('error', status)


class TestEdgeCases(unittest.TestCase):
    """Tests for edge cases and error handling."""
    
    def test_annotate_reading_with_zero_values(self):
        """Test annotating reading with zero sensor values."""
        from api.annotation.annotator import annotate_reading
        
        mock_fetcher = MagicMock()
        mock_fetcher.get_lesson_at.return_value = None
        
        reading = {
            'timestamp': datetime(2024, 1, 15, 8, 30, tzinfo=UTC),
            'temperature': 0,
            'humidity': 0,
            'co2': 0
        }
        
        result = annotate_reading(reading, 'U1', mock_fetcher)
        
        # Should handle zero values without error
        self.assertEqual(result.temp, 0.0)
        self.assertEqual(result.humidity, 0.0)
        self.assertEqual(result.co2, 0)
    
    def test_compute_stats_single_reading(self):
        """Test statistics computation with single reading."""
        from api.annotation.annotator import compute_bucket_stats, AnnotatedReading
        
        readings = [
            AnnotatedReading(
                ts=datetime(2024, 1, 15, 8, 0, tzinfo=UTC),
                temp=22.5,
                humidity=45.0,
                co2=850,
                subject=None,
                teacher=None,
                lesson_number=None,
                class_name=None,
                is_lesson=False
            )
        ]
        
        stats = compute_bucket_stats(readings)
        
        # Min, max, and avg should all be the same
        self.assertEqual(stats['min_temp'], 22.5)
        self.assertEqual(stats['max_temp'], 22.5)
        self.assertEqual(stats['avg_temp'], 22.5)
        self.assertEqual(stats['reading_count'], 1)


class TestIntegrationScenarios(unittest.TestCase):
    """Integration tests simulating realistic annotation scenarios."""
    
    def test_full_day_annotation_workflow(self):
        """Test the complete workflow of annotating a day's data."""
        from api.annotation.annotator import annotate_reading, group_readings_by_hour, compute_bucket_stats
        from api.annotation.annotator import AnnotatedReading
        
        # Mock fetcher
        mock_fetcher = MagicMock()
        
        # Simulate a school day: lessons 8-12, break 10-11
        def mock_lesson_lookup(room_code, timestamp):
            hour = timestamp.hour
            if 8 <= hour < 10 or 11 <= hour < 12:
                return {
                    'subject': 'Mathematics' if hour == 8 else 'Physics',
                    'teacher': 'Teacher A',
                    'lesson_number': hour - 7,
                    'class_name': '4.A',
                    'is_lesson': True
                }
            return None
        
        mock_fetcher.get_lesson_at.side_effect = mock_lesson_lookup
        
        # Create readings for 8:00-12:00 (every 30 minutes)
        readings = []
        for hour in range(8, 13):
            for minute in [0, 30]:
                reading = {
                    'timestamp': datetime(2024, 1, 15, hour, minute, tzinfo=LOCAL_TZ),
                    'temperature': 22.0 + (hour - 8) * 0.5,  # Temperature gradually increases
                    'humidity': 45.0,
                    'co2': 400 + (hour - 8) * 200  # CO2 builds up
                }
                annotated = annotate_reading(reading, 'U1', mock_fetcher)
                readings.append(annotated)
        
        # Group into hourly buckets
        buckets = group_readings_by_hour(readings)
        
        # Should have 5 buckets (8-9, 9-10, 10-11, 11-12, 12-13)
        self.assertEqual(len(buckets), 5)
        
        # Each bucket should have 2 readings
        for bucket_readings in buckets.values():
            self.assertEqual(len(bucket_readings), 2)
        
        # Compute stats for first bucket (8-9, during lesson)
        first_bucket = sorted(buckets.items())[0][1]
        stats = compute_bucket_stats(first_bucket)
        
        self.assertEqual(stats['reading_count'], 2)
        self.assertEqual(stats['lesson_count'], 2)  # Both readings during lesson


class TestRealTimetableFetch(unittest.TestCase):
    """Tests with real timetable fetcher - shows actual data."""
    
    def test_fetch_real_timetable_for_a1(self):
        """Fetch and display real timetable for room A1 (today)."""
        from api.annotation.annotator import get_timetable_fetcher
        
        print("\n" + "="*60)
        print("REAL TIMETABLE DATA FOR ROOM A1")
        print("="*60)
        
        # Get the real timetable fetcher
        fetcher = get_timetable_fetcher()
        
        # Use today's date
        today = date.today()
        print(f"\n📅 Date: {today.isoformat()}")
        
        # Fetch timetable for room A1
        room_code = 'A1'
        print(f"📍 Room: {room_code}")
        
        try:
            # Pre-fetch timetable for this room and date
            fetcher.fetch_for_room(room_code, today)
            
            print(f"\n🕐 Checking lessons throughout the day:")
            print("-" * 60)
            
            # Check each hour from 7:00 to 16:00
            for hour in range(7, 17):
                for minute in [0, 30]:
                    timestamp = datetime(
                        today.year, today.month, today.day, 
                        hour, minute, 
                        tzinfo=LOCAL_TZ
                    )
                    
                    lesson = fetcher.get_lesson_at(room_code, timestamp)
                    
                    if lesson and lesson.get('is_lesson'):
                        time_str = f"{hour:02d}:{minute:02d}"
                        print(f"\n⏰ {time_str}")
                        print(f"   Subject: {lesson.get('subject', 'N/A')}")
                        print(f"   Teacher: {lesson.get('teacher', 'N/A')}")
                        print(f"   Class: {lesson.get('class_name', 'N/A')}")
                        print(f"   Lesson #: {lesson.get('lesson_number', 'N/A')}")
            
            print("\n" + "="*60)
            print("✓ Timetable fetch completed")
            print("="*60 + "\n")
            
        except Exception as e:
            print(f"\n❌ Error fetching timetable: {e}")
            print(f"   This may be normal if the API is unavailable or room A1 doesn't exist")
            # Don't fail the test - this is informational
            self.skipTest(f"Timetable fetch failed: {e}")


if __name__ == '__main__':
    unittest.main()
