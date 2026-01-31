"""
Annotated Data API Views for Admin Panel Analytics.
Provides endpoints for lesson-aware statistical analysis of sensor data.
"""

import os
from datetime import datetime, timedelta, timezone
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from pymongo import MongoClient, ASCENDING, DESCENDING
import certifi

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo


UTC = timezone.utc
LOCAL_TZ = ZoneInfo(os.getenv('LOCAL_TIMEZONE', 'Europe/Prague'))


def _get_mongo_client():
    """Create a MongoDB client."""
    mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
    return MongoClient(
        mongo_uri,
        serverSelectionTimeoutMS=5000,
        tlsCAFile=certifi.where(),
        tz_aware=True,
        tzinfo=UTC,
    )


def _get_annotated_collection():
    """Get annotated_readings collection."""
    client = _get_mongo_client()
    db_name = os.getenv('MONGO_DB_NAME', 'cognitiv')
    return client[db_name]['annotated_readings']


def _parse_datetime(value, default=None):
    """Parse ISO datetime string to timezone-aware datetime."""
    if not value:
        return default
    try:
        if isinstance(value, str):
            sanitized = value.strip()
            if sanitized.endswith('Z'):
                sanitized = sanitized[:-1] + '+00:00'
            dt = datetime.fromisoformat(sanitized)
        elif isinstance(value, datetime):
            dt = value
        else:
            return default
        
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=LOCAL_TZ)
        return dt.astimezone(UTC)
    except (ValueError, TypeError):
        return default


@require_http_methods(["GET"])
def annotated_series(request):
    """
    Get time-bucketed annotated readings for charts.
    
    Query params:
        start: ISO datetime (required)
        end: ISO datetime (required)
        device_id: Device MAC address or name (optional)
        bucket: Aggregation bucket - 'hour', 'day', 'week' (default: 'hour')
    
    Returns:
        JSON with series data for charting
    """
    try:
        start_str = request.GET.get('start')
        end_str = request.GET.get('end')
        device_id = request.GET.get('device_id')
        bucket = request.GET.get('bucket', 'hour')
        
        if not start_str or not end_str:
            return JsonResponse({
                'status': 'error',
                'error': 'start and end parameters are required'
            }, status=400)
        
        start_dt = _parse_datetime(start_str)
        end_dt = _parse_datetime(end_str)
        
        if not start_dt or not end_dt:
            return JsonResponse({
                'status': 'error',
                'error': 'Invalid date format. Use ISO 8601.'
            }, status=400)
        
        collection = _get_annotated_collection()
        
        # Build match filter
        match_filter = {
            'bucket_start': {'$gte': start_dt, '$lte': end_dt}
        }
        
        if device_id:
            match_filter['$or'] = [
                {'device_mac': device_id},
                {'device_name': device_id},
                {'room_id': device_id}
            ]
        
        # Determine grouping based on bucket
        if bucket == 'day':
            group_id = {
                'year': {'$year': '$bucket_start'},
                'month': {'$month': '$bucket_start'},
                'day': {'$dayOfMonth': '$bucket_start'}
            }
        elif bucket == 'week':
            group_id = {
                'year': {'$isoWeekYear': '$bucket_start'},
                'week': {'$isoWeek': '$bucket_start'}
            }
        else:  # hour
            group_id = {
                'year': {'$year': '$bucket_start'},
                'month': {'$month': '$bucket_start'},
                'day': {'$dayOfMonth': '$bucket_start'},
                'hour': {'$hour': '$bucket_start'}
            }
        
        pipeline = [
            {'$match': match_filter},
            {'$group': {
                '_id': group_id,
                'bucket_start': {'$min': '$bucket_start'},
                'avg_co2': {'$avg': '$stats.avg_co2'},
                'min_co2': {'$min': '$stats.min_co2'},
                'max_co2': {'$max': '$stats.max_co2'},
                'avg_temp': {'$avg': '$stats.avg_temp'},
                'avg_humidity': {'$avg': '$stats.avg_humidity'},
                'reading_count': {'$sum': '$stats.reading_count'},
                'lesson_count': {'$sum': '$stats.lesson_count'}
            }},
            {'$sort': {'bucket_start': 1}},
            {'$project': {
                '_id': 0,
                'bucket_start': 1,
                'avg_co2': {'$round': ['$avg_co2', 0]},
                'min_co2': 1,
                'max_co2': 1,
                'avg_temp': {'$round': ['$avg_temp', 1]},
                'avg_humidity': {'$round': ['$avg_humidity', 0]},
                'reading_count': 1,
                'lesson_count': 1
            }}
        ]
        
        results = list(collection.aggregate(pipeline))
        
        # Convert datetime objects to ISO strings for JSON
        series = []
        for item in results:
            series.append({
                'bucket_start': item['bucket_start'].isoformat() if item.get('bucket_start') else None,
                'avg_co2': item.get('avg_co2'),
                'min_co2': item.get('min_co2'),
                'max_co2': item.get('max_co2'),
                'avg_temp': item.get('avg_temp'),
                'avg_humidity': item.get('avg_humidity'),
                'reading_count': item.get('reading_count', 0),
                'lesson_count': item.get('lesson_count', 0)
            })
        
        return JsonResponse({
            'status': 'success',
            'series': series,
            'count': len(series)
        })
        
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'error': str(e)
        }, status=500)


@require_http_methods(["GET"])
def annotated_summary(request):
    """
    Get statistical summary of annotated readings.
    
    Query params:
        start: ISO datetime (optional, defaults to 7 days ago)
        end: ISO datetime (optional, defaults to now)
        device_id: Device filter (optional)
    
    Returns:
        JSON with aggregate statistics including by-subject breakdown
    """
    try:
        end_dt = _parse_datetime(request.GET.get('end')) or datetime.now(UTC)
        start_dt = _parse_datetime(request.GET.get('start')) or (end_dt - timedelta(days=7))
        device_id = request.GET.get('device_id')
        
        collection = _get_annotated_collection()
        
        match_filter = {
            'bucket_start': {'$gte': start_dt, '$lte': end_dt}
        }
        
        if device_id:
            match_filter['$or'] = [
                {'device_mac': device_id},
                {'device_name': device_id},
                {'room_id': device_id}
            ]
        
        # Overall stats pipeline
        overall_pipeline = [
            {'$match': match_filter},
            {'$group': {
                '_id': None,
                'total_readings': {'$sum': '$stats.reading_count'},
                'total_lessons': {'$sum': '$stats.lesson_count'},
                'avg_co2': {'$avg': '$stats.avg_co2'},
                'min_co2': {'$min': '$stats.min_co2'},
                'max_co2': {'$max': '$stats.max_co2'},
                'avg_temp': {'$avg': '$stats.avg_temp'},
                'avg_humidity': {'$avg': '$stats.avg_humidity'}
            }}
        ]
        
        overall_result = list(collection.aggregate(overall_pipeline))
        overall_stats = overall_result[0] if overall_result else {}
        
        # Subject breakdown pipeline
        subject_pipeline = [
            {'$match': match_filter},
            {'$unwind': '$readings'},
            {'$match': {'readings.is_lesson': True, 'readings.subject': {'$ne': None}}},
            {'$group': {
                '_id': '$readings.subject',
                'reading_count': {'$sum': 1},
                'avg_co2': {'$avg': '$readings.co2'},
                'min_co2': {'$min': '$readings.co2'},
                'max_co2': {'$max': '$readings.co2'}
            }},
            {'$sort': {'reading_count': -1}},
            {'$project': {
                '_id': 0,
                'subject': '$_id',
                'reading_count': 1,
                'avg_co2': {'$round': ['$avg_co2', 0]},
                'min_co2': 1,
                'max_co2': 1
            }}
        ]
        
        subjects = list(collection.aggregate(subject_pipeline))
        
        # CO2 quality breakdown
        quality_pipeline = [
            {'$match': match_filter},
            {'$unwind': '$readings'},
            {'$group': {
                '_id': None,
                'good': {'$sum': {'$cond': [{'$lt': ['$readings.co2', 1000]}, 1, 0]}},
                'moderate': {'$sum': {'$cond': [{'$and': [
                    {'$gte': ['$readings.co2', 1000]},
                    {'$lt': ['$readings.co2', 1500]}
                ]}, 1, 0]}},
                'high': {'$sum': {'$cond': [{'$and': [
                    {'$gte': ['$readings.co2', 1500]},
                    {'$lt': ['$readings.co2', 2000]}
                ]}, 1, 0]}},
                'critical': {'$sum': {'$cond': [{'$gte': ['$readings.co2', 2000]}, 1, 0]}}
            }}
        ]
        
        quality_result = list(collection.aggregate(quality_pipeline))
        quality = quality_result[0] if quality_result else {'good': 0, 'moderate': 0, 'high': 0, 'critical': 0}
        quality.pop('_id', None)
        
        return JsonResponse({
            'status': 'success',
            'summary': {
                'total_readings': overall_stats.get('total_readings', 0),
                'total_lessons': overall_stats.get('total_lessons', 0),
                'avg_co2': round(overall_stats.get('avg_co2', 0) or 0),
                'min_co2': overall_stats.get('min_co2'),
                'max_co2': overall_stats.get('max_co2'),
                'avg_temp': round(overall_stats.get('avg_temp', 0) or 0, 1),
                'avg_humidity': round(overall_stats.get('avg_humidity', 0) or 0),
                'co2_quality': quality
            },
            'by_subject': subjects
        })
        
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'error': str(e)
        }, status=500)


@require_http_methods(["GET"])
def annotated_lessons(request):
    """
    Get lesson-by-lesson analysis.
    
    Query params:
        start: ISO datetime (optional)
        end: ISO datetime (optional) 
        device_id: Device filter (optional)
    
    Returns:
        JSON with lesson analysis (by teacher, by period)
    """
    try:
        end_dt = _parse_datetime(request.GET.get('end')) or datetime.now(UTC)
        start_dt = _parse_datetime(request.GET.get('start')) or (end_dt - timedelta(days=7))
        device_id = request.GET.get('device_id')
        
        collection = _get_annotated_collection()
        
        match_filter = {
            'bucket_start': {'$gte': start_dt, '$lte': end_dt}
        }
        
        if device_id:
            match_filter['$or'] = [
                {'device_mac': device_id},
                {'device_name': device_id},
                {'room_id': device_id}
            ]
        
        # By teacher pipeline - count unique lessons (Day + Lesson Number)
        teacher_pipeline = [
            {'$match': match_filter},
            {'$unwind': '$readings'},
            {'$match': {'readings.is_lesson': True, 'readings.teacher': {'$ne': None}}},
            {'$group': {
                # First group by lesson instance (Day + Lesson Number) to deduplicate if lesson spans buckets
                '_id': {
                    'teacher': '$readings.teacher',
                    'year': {'$year': '$bucket_start'},
                    'month': {'$month': '$bucket_start'},
                    'day': {'$dayOfMonth': '$bucket_start'},
                    'lesson': '$readings.lesson_number'
                },
                'avg_co2': {'$avg': '$readings.co2'},
                'max_co2': {'$max': '$readings.co2'}
            }},
            {'$group': {
                # Now group by teacher
                '_id': '$_id.teacher',
                'lesson_count': {'$sum': 1},
                'avg_co2': {'$avg': '$avg_co2'},
                'max_co2': {'$max': '$max_co2'}
            }},
            {'$sort': {'lesson_count': -1}},
            {'$limit': 20},
            {'$project': {
                '_id': 0,
                'teacher': '$_id',
                'lesson_count': 1,
                'avg_co2': {'$round': ['$avg_co2', 0]},
                'max_co2': 1
            }}
        ]
        
        by_teacher = list(collection.aggregate(teacher_pipeline))

        # Clean teacher names (deduplicate comma-separated names)
        for item in by_teacher:
            teacher_name = item.get('teacher', '')
            if teacher_name and ',' in teacher_name:
                # Split, strip, deduplicate, and join
                unique_names = sorted(list(set(name.strip() for name in teacher_name.split(','))))
                item['teacher'] = ', '.join(unique_names)
        
        # By lesson period pipeline
        period_pipeline = [
            {'$match': match_filter},
            {'$unwind': '$readings'},
            {'$match': {'readings.is_lesson': True, 'readings.lesson_number': {'$ne': None}}},
            {'$group': {
                '_id': '$readings.lesson_number',
                'reading_count': {'$sum': 1},
                'avg_co2': {'$avg': '$readings.co2'},
                'max_co2': {'$max': '$readings.co2'}
            }},
            {'$sort': {'_id': 1}},
            {'$project': {
                '_id': 0,
                'lesson_number': '$_id',
                'reading_count': 1,
                'avg_co2': {'$round': ['$avg_co2', 0]},
                'max_co2': 1
            }}
        ]
        
        by_period = list(collection.aggregate(period_pipeline))
        
        return JsonResponse({
            'status': 'success',
            'by_teacher': by_teacher,
            'by_period': by_period
        })
        
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'error': str(e)
        }, status=500)


@require_http_methods(["GET"])
def annotated_heatmap(request):
    """
    Get heatmap data.
    
    Query params:
        start: ISO datetime (optional)
        end: ISO datetime (optional)
        mode: 'hourly' (default) or 'daily'
        device_id: Device filter (optional)
        weeks: (Deprecated) Number of weeks to include (default: 4)
    
    Returns:
        JSON with heatmap data
    """
    try:
        device_id = request.GET.get('device_id')
        mode = request.GET.get('mode', 'hourly')
        
        # Date logic
        start_str = request.GET.get('start')
        end_str = request.GET.get('end')
        
        if start_str and end_str:
            start_dt = _parse_datetime(start_str)
            end_dt = _parse_datetime(end_str)
        else:
            # Fallback to weeks logic
            weeks = int(request.GET.get('weeks', 4))
            end_dt = datetime.now(UTC)
            start_dt = end_dt - timedelta(weeks=weeks)
        
        collection = _get_annotated_collection()
        
        match_filter = {
            'bucket_start': {'$gte': start_dt, '$lte': end_dt}
        }
        
        if device_id:
            match_filter['$or'] = [
                {'device_mac': device_id},
                {'device_name': device_id},
                {'room_id': device_id}
            ]
            
        if mode == 'daily':
            pipeline = [
                {'$match': match_filter},
                {'$group': {
                    '_id': {
                        'year': {'$year': '$bucket_start'},
                        'month': {'$month': '$bucket_start'},
                        'day': {'$dayOfMonth': '$bucket_start'}
                    },
                    'bucket_start': {'$min': '$bucket_start'},
                    'avg_co2': {'$avg': '$stats.avg_co2'},
                    'reading_count': {'$sum': '$stats.reading_count'}
                }},
                {'$sort': {'bucket_start': 1}},
                {'$project': {
                    '_id': 0,
                    'bucket_start': 1,
                    'avg_co2': {'$round': ['$avg_co2', 0]},
                    'reading_count': 1
                }}
            ]
            
            results = list(collection.aggregate(pipeline))
            
            # Format for daily view (list of days)
            heatmap = []
            for item in results:
                heatmap.append({
                    'date': item['bucket_start'].isoformat() if item.get('bucket_start') else None,
                    'avg_co2': item.get('avg_co2'),
                    'reading_count': item.get('reading_count', 0)
                })
                
        else:
            # Hourly mode - Filter for school hours (07:00 - 16:00) using configured timezone
            tz_name = os.getenv('LOCAL_TIMEZONE', 'Europe/Prague')
            
            pipeline = [
                {'$match': match_filter},
                {'$project': {
                    'bucket_start': 1,
                    'stats': 1,
                    'hour': {'$hour': {'date': '$bucket_start', 'timezone': tz_name}}
                }},
                {'$match': {
                    'hour': {'$gte': 7, '$lte': 16}
                }},
                {'$group': {
                    '_id': {
                        'dayOfWeek': {'$dayOfWeek': {'date': '$bucket_start', 'timezone': tz_name}},
                        'hour': '$hour'
                    },
                    'avg_co2': {'$avg': '$stats.avg_co2'},
                    'reading_count': {'$sum': '$stats.reading_count'}
                }},
                {'$project': {
                    '_id': 0,
                    'dayOfWeek': '$_id.dayOfWeek',
                    'hour': '$_id.hour',
                    'avg_co2': {'$round': ['$avg_co2', 0]},
                    'reading_count': 1
                }}
            ]
            
            results = list(collection.aggregate(pipeline))
            
            # Build heatmap grid (7 days × 24 hours)
            heatmap = {}
            for item in results:
                mongo_day = item['dayOfWeek']
                # MongoDB: 1=Sun, 2=Mon...
                iso_day = (mongo_day + 5) % 7 + 1
                hour = item['hour']
                key = f"{iso_day}_{hour}"
                heatmap[key] = {
                    'avg_co2': item['avg_co2'],
                    'reading_count': item['reading_count']
                }

        return JsonResponse({
            'status': 'success',
            'heatmap': heatmap,
            'mode': mode,
            'start': start_dt.isoformat(),
            'end': end_dt.isoformat()
        })
        
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'error': str(e)
        }, status=500)
