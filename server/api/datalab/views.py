"""
DataLab API Views
Provides endpoints for data export, query preview, and preset management.
"""
import json
from django.http import StreamingHttpResponse, JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from pymongo import MongoClient
import certifi
import os
from datetime import datetime, timezone

from .export_engine import ExportEngine, get_mongo_uri, get_mongo_db_name
from .query_builder import QueryBuilder

UTC = timezone.utc


def get_presets_collection():
    """Get datalab_presets collection."""
    client = MongoClient(
        get_mongo_uri(),
        serverSelectionTimeoutMS=5000,
        tlsCAFile=certifi.where(),
        tz_aware=True,
        tzinfo=UTC,
    )
    db = client[get_mongo_db_name()]
    return db['datalab_presets']


def get_annotated_readings_collection():
    """Get annotated_readings collection."""
    client = MongoClient(
        get_mongo_uri(),
        serverSelectionTimeoutMS=5000,
        tlsCAFile=certifi.where(),
        tz_aware=True,
        tzinfo=UTC,
    )
    db = client[get_mongo_db_name()]
    return db['annotated_readings']


@csrf_exempt
@require_http_methods(["POST"])
def preview_query(request):
    """
    Preview query results with row count estimate and sample data.
    Uses annotated_readings collection.
    
    POST /api/datalab/preview
    Body: {
        "filters": {
            "start": "2026-01-01",
            "end": "2026-01-31",
            "rooms": ["b2", "b4"]
        }
    }
    
    Response: {
        "estimated_count": 1234,
        "preview_data": [...]
    }
    """
    try:
        body = json.loads(request.body)
        filters = body.get('filters', {})
        
        qb = QueryBuilder()
        pipeline = qb.build_pipeline(filters)
        
        collection = get_annotated_readings_collection()
        
        # Get count estimate (count unwound readings)
        count_pipeline = pipeline.copy()
        # Remove limit for count
        count_pipeline = [stage for stage in count_pipeline if '$limit' not in stage]
        count_pipeline.append({'$count': 'total'})
        count_result = list(collection.aggregate(count_pipeline))
        estimated_count = count_result[0]['total'] if count_result else 0
        
        # Get preview data - already unwound by pipeline
        unwound_docs = list(collection.aggregate(pipeline))
        
        # Format preview data - readings are in 'readings' field after unwind
        preview_data = []
        for doc in unwound_docs[:100]:  # Max 100 for preview
            reading = doc.get('readings', {})
            ts = reading.get('ts')
            if isinstance(ts, datetime):
                ts = ts.isoformat()
            
            preview_data.append({
                'timestamp': ts,
                'room': doc.get('room_id', 'Unknown'),
                'co2': reading.get('co2'),
                'temp': reading.get('temp'),
                'humidity': reading.get('humidity'),
                'subject': reading.get('subject'),
                'teacher': reading.get('teacher'),
                'class_name': reading.get('class_name'),
                'occupancy': doc.get('context', {}).get('lesson', {}).get('estimated_occupancy', 0),
                'is_lesson': reading.get('is_lesson', False),
            })
        
        return JsonResponse({
            'estimated_count': estimated_count,
            'preview_data': preview_data
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def export_data(request):
    """
    Stream export data in specified format.
    
    GET /api/datalab/export?start=2026-01-01&end=2026-01-31&rooms=b4,b5&format=csv
    
    Query Parameters:
        - start: Start date (ISO format)
        - end: End date (ISO format)
        - rooms: Comma-separated room IDs (optional)
        - format: Export format (csv|jsonl|pdf)
    
    Response: Streaming file download
    """
    try:
        # Parse query parameters
        start_date = request.GET.get('start')
        end_date = request.GET.get('end')
        rooms_param = request.GET.get('rooms', '')
        export_format = request.GET.get('format', 'csv')
        
        if not start_date or not end_date:
            return JsonResponse({'error': 'start and end dates are required'}, status=400)
        
        # Parse rooms
        rooms = [r.strip() for r in rooms_param.split(',') if r.strip()] if rooms_param else []
        
        filters = {
            'start': start_date,
            'end': end_date,
            'rooms': rooms
        }
        
        # Validate format
        if export_format not in ['csv', 'jsonl', 'pdf']:
            return JsonResponse({'error': 'Invalid format. Must be csv, jsonl, or pdf'}, status=400)
        
        # Create export engine
        engine = ExportEngine()
        
        # Determine content type and filename
        content_types = {
            'csv': 'text/csv',
            'jsonl': 'application/x-ndjson',
            'pdf': 'application/pdf'
        }
        
        extensions = {
            'csv': 'csv',
            'jsonl': 'jsonl',
            'pdf': 'pdf'
        }
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'cognitiv_export_{timestamp}.{extensions[export_format]}'
        
        # Create streaming response
        response = StreamingHttpResponse(
            engine.export_stream(filters, export_format),
            content_type=content_types[export_format]
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        return response
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def manage_presets(request):
    """
    Manage query presets.
    
    GET /api/datalab/presets
    Response: { "presets": [...] }
    
    POST /api/datalab/presets
    Body: {
        "name": "My Preset",
        "filters": {...}
    }
    Response: { "id": "...", "name": "...", "filters": {...} }
    """
    collection = get_presets_collection()
    
    if request.method == 'GET':
        # List all presets
        presets = list(collection.find({}, {'_id': 1, 'name': 1, 'filters': 1, 'created_at': 1}))
        
        # Convert ObjectId to string
        for preset in presets:
            preset['id'] = str(preset.pop('_id'))
            if 'created_at' in preset and isinstance(preset['created_at'], datetime):
                preset['created_at'] = preset['created_at'].isoformat()
        
        return JsonResponse({'presets': presets})
    
    elif request.method == 'POST':
        # Create new preset
        try:
            body = json.loads(request.body)
            name = body.get('name')
            filters = body.get('filters')
            
            if not name:
                return JsonResponse({'error': 'name is required'}, status=400)
            
            preset_doc = {
                'name': name,
                'filters': filters or {},
                'created_at': datetime.now(UTC)
            }
            
            result = collection.insert_one(preset_doc)
            preset_doc['id'] = str(result.inserted_id)
            preset_doc.pop('_id', None)
            preset_doc['created_at'] = preset_doc['created_at'].isoformat()
            
            return JsonResponse(preset_doc, status=201)
            
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["DELETE"])
def delete_preset(request, preset_id):
    """
    Delete a preset by ID.
    
    DELETE /api/datalab/presets/<preset_id>
    Response: { "success": true }
    """
    try:
        from bson import ObjectId
        
        collection = get_presets_collection()
        
        # Validate ObjectId
        try:
            obj_id = ObjectId(preset_id)
        except:
            return JsonResponse({'error': 'Invalid preset ID'}, status=400)
        
        result = collection.delete_one({'_id': obj_id})
        
        if result.deleted_count == 0:
            return JsonResponse({'error': 'Preset not found'}, status=404)
        
        return JsonResponse({'success': True})
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
