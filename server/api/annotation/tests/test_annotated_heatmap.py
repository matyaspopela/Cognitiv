
import json
from unittest.mock import MagicMock, patch
from datetime import datetime
from django.test import SimpleTestCase, RequestFactory
from api.annotation.annotated_api import annotated_heatmap

class AnnotatedHeatmapTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

    @patch('api.annotation.annotated_api._get_annotated_collection')
    def test_annotated_heatmap_hourly_structure(self, mock_get_collection):
        """Test that hourly mode produces the correct pipeline and structure."""
        # Setup mock return
        mock_collection = MagicMock()
        mock_get_collection.return_value = mock_collection
        
        # Mock aggregation result
        mock_collection.aggregate.return_value = [
            {
                'dayOfWeek': 2, # Mon
                'hour': 8,
                'avg_co2': 800,
                'reading_count': 10
            }
        ]

        # Create request
        request = self.factory.get('/annotated/heatmap', {
            'start': '2023-01-01T00:00:00Z',
            'end': '2023-01-07T00:00:00Z',
            'mode': 'hourly'
        })

        # Call view
        response = annotated_heatmap(request)
        content = json.loads(response.content)

        # Verify success
        self.assertEqual(response.status_code, 200)
        self.assertEqual(content['status'], 'success')
        
        # Verify aggregation pipeline
        pipeline = mock_collection.aggregate.call_args[0][0]
        
        # Check match stage (Index 0)
        match_stage = pipeline[0]['$match']
        self.assertIn('bucket_start', match_stage)

        # Check hour filtering (Index 2 - after project)
        hour_match_stage = pipeline[2]['$match']
        self.assertIn('hour', hour_match_stage)
        
        # Check grouping (Index 3)
        group_stage = pipeline[3]['$group']
        self.assertIn('hour', group_stage['_id'])
        self.assertIn('dayOfWeek', group_stage['_id'])

    @patch('api.annotation.annotated_api._get_annotated_collection')
    def test_annotated_heatmap_daily_structure(self, mock_get_collection):
        """Test that daily mode produces the correct pipeline and structure."""
        # Setup mock return
        mock_collection = MagicMock()
        mock_get_collection.return_value = mock_collection
        
        # Mock aggregation result
        mock_collection.aggregate.return_value = [
            {
                'bucket_start': datetime(2023, 1, 1),
                'avg_co2': 900,
                'reading_count': 100
            }
        ]

        # Create request
        request = self.factory.get('/annotated/heatmap', {
            'start': '2023-01-01T00:00:00Z',
            'end': '2023-01-30T00:00:00Z',
            'mode': 'daily'
        })

        # Call view
        response = annotated_heatmap(request)
        content = json.loads(response.content)

        # Verify success
        self.assertEqual(response.status_code, 200)
        self.assertEqual(content['status'], 'success')
        
        # Verify aggregation pipeline
        pipeline = mock_collection.aggregate.call_args[0][0]
        
        # Check match stage
        match_stage = pipeline[0]['$match']
        self.assertIn('bucket_start', match_stage)
        
        # Check grouping (should be by day)
        group_stage = pipeline[1]['$group']
        self.assertIn('year', group_stage['_id'])
        self.assertIn('month', group_stage['_id'])
        self.assertIn('day', group_stage['_id'])
