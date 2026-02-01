
import unittest
from datetime import datetime
from server.api.datalab.query_builder import QueryBuilder

class TestQueryBuilder(unittest.TestCase):
    def setUp(self):
        self.qb = QueryBuilder()

    def test_build_simple_match(self):
        filters = {
            'rooms': ['b4', 'a1'],
            'start': '2023-10-27T00:00:00',
            'end': '2023-10-28T00:00:00'
        }
        pipeline = self.qb.build_pipeline(filters)
        
        match_stage = pipeline[0]['$match']
        self.assertEqual(match_stage['room_id']['$in'], ['b4', 'a1'])
        self.assertIsInstance(match_stage['bucket_start']['$gte'], datetime)

    def test_security_prevents_injection(self):
        """Test that passing a dict as room_id (NoSQL injection) is rejected."""
        filters = {
            'rooms': {'$ne': 'b4'}, # Malicious input
            'start': '2023-10-27T00:00:00',
            'end': '2023-10-28T00:00:00'
        }
        
        with self.assertRaises(ValueError):
            self.qb.build_pipeline(filters)

if __name__ == '__main__':
    unittest.main()
