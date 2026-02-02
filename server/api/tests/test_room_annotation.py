"""
Tests for room annotation system.

Verifies that:
1. Room parameters can be loaded from JSON config
2. Room parameters are correctly injected into annotations
3. Missing room parameters are handled gracefully
"""

import unittest
import sys
import os
import tempfile
import json
from unittest.mock import MagicMock, patch

# Add server to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from django.conf import settings
if not settings.configured:
    settings.configure(DEFAULT_CHARSET='utf-8')


class TestRoomAnnotation(unittest.TestCase):
    """Tests for room parameter injection into annotations."""
    
    def setUp(self):
        """Create a temporary JSON for testing."""
        # Reset RoomManager singleton before each test
        from api.annotation.room_manager import RoomManager
        RoomManager._instance = None
        
        self.temp_json = tempfile.NamedTemporaryFile(
            mode='w', 
            suffix='.json', 
            delete=False,
            encoding='utf-8'
        )
        config_data = {
            "class_occupancy": {"1.A": 30},
            "room_parameters": [
                {"room_id": "test_room", "label": "Test Room", "volume_m3": 100.5, "window_area_m2": 3.0},
                {"room_id": "another_room", "label": "Another Room", "volume_m3": 150.0, "window_area_m2": 5.0}
            ]
        }
        json.dump(config_data, self.temp_json)
        self.temp_json.close()
    
    def tearDown(self):
        """Clean up temporary file and reset singleton."""
        try:
            os.unlink(self.temp_json.name)
        except:
            pass
        
        # Reset RoomManager singleton after each test
        from api.annotation.room_manager import RoomManager
        RoomManager._instance = None
    
    @patch('api.annotation.room_manager.MongoClient')
    def test_sync_parameters_creates_documents(self, mock_client):
        """Test that sync_parameters creates room documents in MongoDB."""
        from api.annotation.room_manager import RoomManager
        
        # Setup mock
        mock_collection = MagicMock()
        mock_db = MagicMock()
        mock_db.__getitem__ = MagicMock(return_value=mock_collection)
        mock_client.return_value.__getitem__ = MagicMock(return_value=mock_db)
        
        # Create fresh instance
        RoomManager._instance = None
        manager = RoomManager()
        
        # Call sync_parameters
        count = manager.sync_parameters(self.temp_json.name)
        
        # Verify
        self.assertEqual(count, 2)
        self.assertEqual(mock_collection.update_one.call_count, 2)
    
    @patch('api.annotation.room_manager.MongoClient')
    def test_get_room_parameters_returns_correct_fields(self, mock_client):
        """Test that get_room_parameters returns physical parameters."""
        from api.annotation.room_manager import RoomManager
        
        # Setup mock to return room data
        mock_collection = MagicMock()
        mock_collection.find_one.return_value = {
            '_id': 'test_room',
            'label': 'Test Room',
            'volume_m3': 100.5,
            'window_area_m2': 3.0
        }
        mock_db = MagicMock()
        mock_db.__getitem__ = MagicMock(return_value=mock_collection)
        mock_client.return_value.__getitem__ = MagicMock(return_value=mock_db)
        
        # Create fresh instance
        RoomManager._instance = None
        manager = RoomManager()
        
        # Get parameters
        params = manager.get_room_parameters('test_room')
        
        # Verify structure
        self.assertIsNotNone(params)
        self.assertEqual(params['volume_m3'], 100.5)
        self.assertEqual(params['window_area_m2'], 3.0)
    
    @patch('api.annotation.room_manager.MongoClient')
    def test_get_room_parameters_missing_room(self, mock_client):
        """Test that missing rooms return None."""
        from api.annotation.room_manager import RoomManager
        
        # Setup mock to return None
        mock_collection = MagicMock()
        mock_collection.find_one.return_value = None
        mock_db = MagicMock()
        mock_db.__getitem__ = MagicMock(return_value=mock_collection)
        mock_client.return_value.__getitem__ = MagicMock(return_value=mock_db)
        
        # Create fresh instance
        RoomManager._instance = None
        manager = RoomManager()
        
        # Get parameters for non-existent room
        params = manager.get_room_parameters('nonexistent_room')
        
        # Verify
        self.assertIsNone(params)


class TestMoldCalculator(unittest.TestCase):
    """Tests for mold factor calculation."""
    
    def test_mold_factor_safe_conditions(self):
        """Test mold factor for safe conditions (low humidity, normal temp)."""
        from api.analytics.mold_calculator import calculate_mold_factor, MoldRiskLevel
        
        result = calculate_mold_factor(humidity_rel=50.0, temp_c=22.0)
        
        self.assertEqual(result.risk_level, MoldRiskLevel.NONE)
        self.assertLess(result.mold_factor, 1.0)
    
    def test_mold_factor_risky_conditions(self):
        """Test mold factor for risky conditions (high humidity, warm temp)."""
        from api.analytics.mold_calculator import calculate_mold_factor, MoldRiskLevel
        
        result = calculate_mold_factor(
            humidity_rel=95.0, 
            temp_c=25.0, 
            exposure_hours=24.0
        )
        
        self.assertIn(result.risk_level, [MoldRiskLevel.HIGH, MoldRiskLevel.CRITICAL])
        self.assertGreater(result.mold_factor, 4.0)
    
    def test_mold_factor_handles_none_values(self):
        """Test that None values are handled gracefully."""
        from api.analytics.mold_calculator import calculate_mold_factor, MoldRiskLevel
        
        result = calculate_mold_factor(humidity_rel=None, temp_c=22.0)
        
        self.assertEqual(result.risk_level, MoldRiskLevel.NONE)
        self.assertEqual(result.mold_factor, 0.0)
    
    def test_mold_factor_simple_returns_float(self):
        """Test simplified calculation returns just the factor value."""
        from api.analytics.mold_calculator import calculate_mold_factor_simple
        
        factor = calculate_mold_factor_simple(humidity_rel=70.0, temp_c=22.0)
        
        self.assertIsInstance(factor, float)
        self.assertGreaterEqual(factor, 0.0)
        self.assertLessEqual(factor, 10.0)
    
    def test_critical_rh_varies_with_temperature(self):
        """Test that critical RH threshold changes with temperature."""
        from api.analytics.mold_calculator import calculate_critical_rh
        
        rh_cold = calculate_critical_rh(5.0)
        rh_normal = calculate_critical_rh(20.0)
        rh_warm = calculate_critical_rh(30.0)
        
        # Critical RH should be higher at lower temps
        self.assertGreater(rh_cold, rh_normal)
        self.assertGreater(rh_normal, rh_warm)


if __name__ == '__main__':
    unittest.main()