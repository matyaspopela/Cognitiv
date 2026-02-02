"""
DataLab Filter Options API

Provides endpoints for fetching available filter options from the database.
"""

import os
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from pymongo import MongoClient
import certifi
from django.utils import timezone

def _get_annotated_readings_collection():
    """Get annotated_readings collection."""
    mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
    db_name = os.getenv('MONGO_DB_NAME', 'cognitiv')
    
    client = MongoClient(
        mongo_uri,
        serverSelectionTimeoutMS=5000,
        tlsCAFile=certifi.where(),
        tz_aware=True,
    )
    return client[db_name]['annotated_readings']

@csrf_exempt
def get_filter_options(request):
    """
    Get available filter options (teachers, subjects, rooms, classes).
    
    Returns:
        JSON with arrays of distinct values for each filter type
    """
    try:
        collection = _get_annotated_readings_collection()
        
        # Aggregate to get distinct values
        pipeline = [
            {'$unwind': '$readings'},
            {
                '$group': {
                    '_id': None,
                    'rooms': {'$addToSet': '$room_id'},
                    'subjects': {'$addToSet': '$readings.subject'},
                    'teachers': {'$addToSet': '$readings.teacher'}
                }
            },
            {
                '$project': {
                    '_id': 0,
                    'rooms': 1,
                    'subjects': {
                        '$filter': {
                            'input': '$subjects',
                            'as': 's',
                            'cond': {'$ne': ['$$s', None]}
                        }
                    },
                    'teachers': {
                        '$filter': {
                            'input': '$teachers',
                            'as': 't',
                            'cond': {'$ne': ['$$t', None]}
                        }
                    }
                }
            }
        ]
        
        result = list(collection.aggregate(pipeline))
        
        if result:
            data = result[0]
            # Sort the arrays for better UX
            data['rooms'] = sorted(data.get('rooms', []))
            data['subjects'] = sorted(data.get('subjects', []))
            data['teachers'] = sorted(data.get('teachers', []))
            data['classes'] = []  # Placeholder for future class data
        else:
            data = {
                'rooms': [],
                'subjects': [],
                'teachers': [],
                'classes': []
            }
        
        return JsonResponse({
            'status': 'success',
            'data': data
        })
    
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)
