
import unittest
from unittest.mock import MagicMock, patch
from server.api.annotation.room_manager import RoomManager
from server.api.annotation.room_config import VALID_ROOM_CODES, ROOM_CODE_LABELS

class TestRoomManager(unittest.TestCase):
    
    @patch('server.api.annotation.room_manager.MongoClient')
    def setUp(self, mock_client):
        # Reset Singleton
        RoomManager._instance = None
        
        self.mock_client = mock_client
        self.mock_db = MagicMock()
        self.mock_collection = MagicMock()
        
        # Setup the chain of mocks
        self.mock_client.return_value = MagicMock()
        self.mock_client.return_value.__getitem__.return_value = self.mock_db
        self.mock_db.__getitem__.return_value = self.mock_collection
        
        self.room_manager = RoomManager()
        # Inject the mock collection directly to avoid re-instantiation issues during tests if any
        self.room_manager._collection = self.mock_collection

    def test_get_room_returns_none_if_not_found(self):
        """Test that get_room returns None if room doesn't exist in DB."""
        self.mock_collection.find_one.return_value = None
        
        result = self.room_manager.get_room("nonexistent")
        self.assertIsNone(result)
        self.mock_collection.find_one.assert_called_with({'_id': "nonexistent"})

    def test_get_room_returns_room_data(self):
        """Test that get_room returns the room document."""
        mock_room = {
            '_id': 'b4',
            'label': 'Biology Lab',
            'volume_m3': 100.0
        }
        self.mock_collection.find_one.return_value = mock_room
        
        result = self.room_manager.get_room("b4")
        self.assertEqual(result, mock_room)

    @patch('server.api.annotation.room_manager.VALID_ROOM_CODES', ['b4', 'a1'])
    @patch('server.api.annotation.room_manager.ROOM_CODE_LABELS', {'b4': 'Biology', 'a1': 'Aula'})
    def test_sync_config_populates_db(self):
        """Test that sync_config inserts/updates rooms from room_config.py."""
        
        # Setup find_one to return None (simulating empty DB)
        self.mock_collection.find_one.return_value = None
        
        count = self.room_manager.sync_config()
        
        # Should call update_one (upsert) for each room in VALID_ROOM_CODES
        self.assertEqual(count, 2)
        self.assertEqual(self.mock_collection.update_one.call_count, 2)
        
        # Verify call args for one room
        call_args = self.mock_collection.update_one.call_args_list
        
        # Check first call (order might vary but list is small)
        # Expected upsert for 'b4'
        # args[0] is the filter, args[1] is the update, kwargs has upsert=True
        
        # We just verify that update_one was called with upsert=True
        _, kwargs = call_args[0]
        self.assertTrue(kwargs.get('upsert'))

    def test_caching_behavior(self):
        """Test that repeated get_room calls hit cache."""
        # This test assumes we implement caching. 
        # For the RED phase, we just assert the interface works, 
        # but if we strictly follow TDD, we should probably test the implementation detail 
        # or observe side effects (like find_one being called only once).
        
        mock_room = {'_id': 'b4', 'val': 1}
        self.mock_collection.find_one.return_value = mock_room
        
        # First call
        self.room_manager.get_room("b4")
        
        # Second call
        self.room_manager.get_room("b4")
        
        # If caching is implemented, find_one should be called only once
        # Note: If this fails in GREEN phase, I'll implement caching.
        # For now, I'll leave checking exact call count to the implementation phase or make it loose.
        # But per spec, caching is required.
        self.mock_collection.find_one.assert_called_once()

if __name__ == '__main__':
    unittest.main()
