"""
Gemini AI Service for IoT Environmental Monitoring System
Provides intelligent assistance for app usage, data analysis, and Q&A
"""

import os
import json
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, List, Any
import google.generativeai as genai
from pymongo.errors import PyMongoError

# Import MongoDB collection getter from views
from .views import get_mongo_collection, to_local_datetime, to_readable_timestamp, round_or_none

# Configuration
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-2.5-flash')

# Initialize Gemini client
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    print("⚠️  GEMINI_API_KEY not set. AI assistant will not be available.")


def get_system_prompt() -> str:
    """Get the system prompt that defines the AI assistant's role and capabilities."""
    return """Jsi MolekulAI asistent pro IoT systém monitorování prostředí, který sleduje:
- Teplotu (ve stupních Celsia)
- Vlhkost (v procentech)
- Hladiny CO2 (v ppm - parts per million)

Tvé schopnosti:
1. Návod k použití aplikace: Pomáhej uživatelům pochopit, jak používat dashboard, zobrazovat historická data, interpretovat grafy a navigovat ve funkcích.
2. Analýza dat: Analyzuj data ze senzorů pro zadaná časová období, poskytuj statistiky, trendy a poznatky.
3. Otázky a odpovědi o datech: Odpovídej na otázky o trendech, anomáliích, korelacích a vzorcích v datech.
4. Zdravotní doporučení: Navrhuj opatření na základě hladin CO2, teploty a vlhkosti.

Směrnice pro kvalitu CO2:
- Dobrá: méně než 1000 ppm
- Střední: 1000-1500 ppm
- Vysoká: 1500-2000 ppm
- Kritická: více než 2000 ppm

Směrnice pro teplotu:
- Komfortní: 20-25°C
- Příliš chladno: méně než 18°C
- Příliš teplo: více než 26°C

Směrnice pro vlhkost:
- Komfortní: 40-60%
- Příliš sucho: méně než 30%
- Příliš vlhko: více než 70%

DŮLEŽITÉ: NEPOUŽÍVEJ markdown formátování (žádné hvězdičky *, podtržítka _, nebo jiné markdown znaky). Používej pouze prostý text s odstavci a odrážkami. Organizuj informace pomocí odstavců, číslování a jednoduchých odrážek bez markdown syntaxe.

Vždy poskytuj stručné, výstižné a praktické odpovědi. Buď konkrétní a přímý. Při analýze dat vysvětli stručně, co jsi zjistil. Odpovídej v češtině a používej kratší, heslovité zprávy místo dlouhých odstavců."""


def fetch_recent_data(hours: int = 24, device_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Fetch recent sensor data for context."""
    try:
        collection = get_mongo_collection()
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=hours)
        
        mongo_filter = {'timestamp': {'$gte': cutoff_time}}
        if device_id:
            # Timeseries format: use metadata.device_id, with backward compatibility
            mongo_filter['$or'] = [
                {'metadata.device_id': device_id},
                {'device_id': device_id}  # Backward compatibility
            ]
        
        cursor = collection.find(mongo_filter).sort('timestamp', -1).limit(100)
        documents = list(cursor)
        documents.reverse()  # Chronological order
        
        data_points = []
        for doc in documents:
            timestamp_local = to_local_datetime(doc.get('timestamp')) if doc.get('timestamp') else None
            timestamp_str = doc.get('timestamp_str') or (timestamp_local.strftime('%Y-%m-%d %H:%M:%S') if timestamp_local else None)
            
            # Extract device_id with backward compatibility (support both old and new format)
            metadata = doc.get('metadata', {})
            device_id_from_doc = metadata.get('device_id') or doc.get('device_id')
            
            data_points.append({
                'timestamp': timestamp_str,
                'device_id': device_id_from_doc,
                'temperature': round_or_none(doc.get('temperature')),
                'humidity': round_or_none(doc.get('humidity')),
                'co2': doc.get('co2')
            })
        
        return data_points
    except Exception as e:
        print(f"Error fetching recent data: {e}")
        return []


def fetch_summary_stats(start_dt: Optional[datetime] = None, end_dt: Optional[datetime] = None, device_id: Optional[str] = None) -> Dict[str, Any]:
    """Fetch summary statistics for a time range."""
    try:
        from .views import parse_iso_datetime, build_history_filter
        
        if not start_dt:
            start_dt = datetime.now(timezone.utc) - timedelta(days=30)
        if not end_dt:
            end_dt = datetime.now(timezone.utc)
        
        mongo_filter = build_history_filter(start_dt, end_dt, device_id)
        collection = get_mongo_collection()
        
        pipeline = [
            {'$match': mongo_filter},
            {
                '$group': {
                    '_id': None,
                    'count': {'$sum': 1},
                    'temp_min': {'$min': '$temperature'},
                    'temp_max': {'$max': '$temperature'},
                    'temp_avg': {'$avg': '$temperature'},
                    'humidity_min': {'$min': '$humidity'},
                    'humidity_max': {'$max': '$humidity'},
                    'humidity_avg': {'$avg': '$humidity'},
                    'co2_min': {'$min': '$co2'},
                    'co2_max': {'$max': '$co2'},
                    'co2_avg': {'$avg': '$co2'},
                }
            }
        ]
        
        result = list(collection.aggregate(pipeline))
        if not result:
            return {}
        
        stats = result[0]
        return {
            'count': stats.get('count', 0),
            'temperature': {
                'min': round_or_none(stats.get('temp_min')),
                'max': round_or_none(stats.get('temp_max')),
                'avg': round_or_none(stats.get('temp_avg')),
            },
            'humidity': {
                'min': round_or_none(stats.get('humidity_min')),
                'max': round_or_none(stats.get('humidity_max')),
                'avg': round_or_none(stats.get('humidity_avg')),
            },
            'co2': {
                'min': stats.get('co2_min'),
                'max': stats.get('co2_max'),
                'avg': round_or_none(stats.get('co2_avg')),
            }
        }
    except Exception as e:
        print(f"Error fetching summary stats: {e}")
        return {}


def build_context_for_query(user_query: str, device_id: Optional[str] = None) -> str:
    """Build context string with relevant data for the AI query."""
    context_parts = []
    
    # Always include recent data for context
    recent_data = fetch_recent_data(hours=24, device_id=device_id)
    if recent_data:
        context_parts.append(f"Recent data (last 24 hours, {len(recent_data)} points):")
        # Include first, last, and a few middle points
        if len(recent_data) > 0:
            context_parts.append(f"  First: {recent_data[0]}")
            if len(recent_data) > 1:
                context_parts.append(f"  Last: {recent_data[-1]}")
            if len(recent_data) > 2:
                mid_idx = len(recent_data) // 2
                context_parts.append(f"  Middle: {recent_data[mid_idx]}")
    
    # Include summary stats
    summary = fetch_summary_stats(device_id=device_id)
    if summary:
        context_parts.append(f"\nSummary statistics (last 30 days):")
        context_parts.append(json.dumps(summary, indent=2))
    
    return "\n".join(context_parts)


def process_ai_query(user_query: str, device_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Process a user query using Gemini AI with relevant data context.
    
    Args:
        user_query: The user's question or request
        device_id: Optional device ID to filter data
    
    Returns:
        Dictionary with 'response', 'status', and optional 'error'
    """
    if not GEMINI_API_KEY:
        return {
            'status': 'error',
            'response': 'MolekulAI asistent není nakonfigurován. Prosím nastavte proměnnou prostředí GEMINI_API_KEY.',
            'error': 'API klíč není nakonfigurován'
        }
    
    try:
        # Build context with relevant data
        data_context = build_context_for_query(user_query, device_id)
        
        # Create the prompt
        prompt = f"""{get_system_prompt()}

Aktuální kontext dat:
{data_context}

Uživatelský dotaz: {user_query}

Prosím poskytni stručnou a výstižnou odpověď na základě kontextu dat a tvých znalostí o monitorování prostředí. Buď konkrétní a přímý - používej kratší, heslovité zprávy. Odpovídej v češtině a POUŽÍVEJ POUZE PROSTÝ TEXT bez markdown formátování (žádné hvězdičky *, podtržítka _, nebo jiné markdown znaky). Organizuj informace pomocí krátkých odstavců, číslování a jednoduchých odrážek bez markdown syntaxe."""

        # Initialize model
        model = genai.GenerativeModel(GEMINI_MODEL)
        
        # Generate response
        response = model.generate_content(prompt)
        
        return {
            'status': 'success',
            'response': response.text,
            'dataUsed': {
                'hasData': bool(data_context),
                'deviceId': device_id
            }
        }
    
    except Exception as e:
        print(f"Error processing AI query: {e}")
        return {
            'status': 'error',
            'response': f'Omlouvám se, došlo k chybě při zpracování vašeho dotazu: {str(e)}',
            'error': str(e)
        }

