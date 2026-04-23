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
        },
        "bucketing": "1h"
    }
    
    Response: {
        "estimated_count": 1234,
        "preview_data": [...]
    }
    """
    try:
        body = json.loads(request.body)
        filters = body.get('filters', {})
        bucketing = body.get('bucketing')
        
        qb = QueryBuilder()
        pipeline = qb.build_pipeline(filters, bucketing=bucketing)
        
        collection = get_annotated_readings_collection()
        
        # Get count estimate
        count_pipeline = pipeline.copy()
        # Remove limit and skip stages if any (build_pipeline no longer adds them by default)
        count_pipeline.append({'$count': 'total'})
        count_result = list(collection.aggregate(count_pipeline))
        estimated_count = count_result[0]['total'] if count_result else 0
        
        # Get preview data (Limit to 50 for preview)
        preview_pipeline = pipeline.copy()
        preview_pipeline.append({'$limit': 50})
        unwound_docs = list(collection.aggregate(preview_pipeline))
        
        # Format preview data - readings are in 'readings' list after build_pipeline (unwound then wrapped if aggregated, or pure unwound if raw? 
        # Wait, if raw, it returns buckets. If aggregated, it returns one object per bucket with a 'readings' LIST of 1 item.
        # But build_pipeline for raw returns buckets with MANY readings. 
        # Let's check query_builder again.
        
        preview_data = []
        for doc in unwound_docs:
            # If raw, doc has 'readings' list. If aggregated, doc has 'readings' list of 1.
            # We want to flatten for the frontend preview table.
            
            readings_list = doc.get('readings', [])
            context = doc.get('context', {})
            
            for reading in readings_list:
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
                    'occupancy': context.get('lesson', {}).get('estimated_occupancy', 0),
                    'is_lesson': reading.get('is_lesson', False),
                })
        
        # Slice again just in case raw data exploded the count
        preview_data = preview_data[:50]
        
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

    GET /api/datalab/export?start=2026-01-01&end=2026-01-31&format=csv&bucketing=1h&source=annotated
    GET /api/datalab/export?start=2026-01-01&end=2026-01-31&format=csv&source=raw&devices=ESP8266A2

    Query Parameters:
        - start:     Start date (ISO format)
        - end:       End date (ISO format)
        - format:    Export format (csv|jsonl)
        - source:    Data source — 'annotated' (default) or 'raw'
        Annotated-only params:
        - rooms:     Comma-separated room IDs (optional)
        - bucketing: Aggregation (raw|15m|1h|1d)
        Raw-only params:
        - devices:   Comma-separated device_id / mac_address values (optional)

    Response: Streaming file download
    """
    try:
        # Common params
        start_date = request.GET.get('start')
        end_date = request.GET.get('end')
        export_format = request.GET.get('format', 'csv')
        source = request.GET.get('source', 'annotated')

        if not start_date or not end_date:
            return JsonResponse({'error': 'start and end dates are required'}, status=400)

        if export_format not in ['csv', 'jsonl']:
            return JsonResponse({'error': 'Invalid format. Must be csv or jsonl'}, status=400)

        if source not in ['annotated', 'raw']:
            return JsonResponse({'error': 'Invalid source. Must be annotated or raw'}, status=400)

        # Source-specific params
        bucketing = None
        filters = {'start': start_date, 'end': end_date}

        if source == 'annotated':
            rooms_param = request.GET.get('rooms', '')
            bucketing_param = request.GET.get('bucketing')
            if bucketing_param and bucketing_param != 'raw':
                bucketing = bucketing_param
            filters['rooms'] = [r.strip() for r in rooms_param.split(',') if r.strip()] if rooms_param else []
        else:  # raw
            devices_param = request.GET.get('devices', '')
            filters['devices'] = [d.strip() for d in devices_param.split(',') if d.strip()] if devices_param else []

        engine = ExportEngine()

        content_types = {'csv': 'text/csv', 'jsonl': 'application/x-ndjson'}
        extensions = {'csv': 'csv', 'jsonl': 'jsonl'}

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        source_suffix = '_raw' if source == 'raw' else ''
        bucketing_suffix = f'_{bucketing}' if bucketing else ''
        filename = f'cognitiv_export{source_suffix}{bucketing_suffix}_{timestamp}.{extensions[export_format]}'

        response = StreamingHttpResponse(
            engine.export_stream(filters, export_format, bucketing, source=source),
            content_type=content_types[export_format]
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)