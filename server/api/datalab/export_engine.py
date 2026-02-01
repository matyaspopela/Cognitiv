import csv
import io
import json
import os
import sys
from typing import Generator, Dict, Any, List, Optional
from datetime import datetime, date, timezone
from pymongo import MongoClient
import certifi
import plotly.graph_objects as go
from plotly.subplots import make_subplots

# Conditional import for PDF generation (WeasyPrint on Linux, ReportLab on Windows)
WEASYPRINT_AVAILABLE = False
REPORTLAB_AVAILABLE = False

try:
    from weasyprint import HTML, CSS
    from weasyprint.text.fonts import FontConfiguration
    WEASYPRINT_AVAILABLE = True
except (ImportError, OSError) as e:
    print(f"WeasyPrint not available: {e}")
    try:
        from reportlab.lib.pagesizes import letter, A4
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.lib import colors
        REPORTLAB_AVAILABLE = True
    except ImportError as e2:
        print(f"ReportLab also not available: {e2}")

from api.services.weather_service import WeatherService
from .query_builder import QueryBuilder

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo

UTC = timezone.utc

def get_mongo_uri() -> str:
    """Get MongoDB URI from environment."""
    return os.getenv('MONGO_URI', 'mongodb://localhost:27017/')

def get_mongo_db_name() -> str:
    """Get MongoDB database name."""
    return os.getenv('MONGO_DB_NAME', 'cognitiv')

def get_annotated_readings_collection():
    """Get annotated readings collection."""
    client = MongoClient(
        get_mongo_uri(),
        serverSelectionTimeoutMS=5000,
        tlsCAFile=certifi.where(),
        tz_aware=True,
        tzinfo=UTC,
    )
    db = client[get_mongo_db_name()]
    return db['annotated_readings']

class ExportEngine:
    def __init__(self):
        self.weather_svc = WeatherService()
        self.qb = QueryBuilder()
    
    def _generate_manifest(self, filters: Dict, row_count: int = 0) -> Dict[str, Any]:
        """
        Generate manifest metadata for reproducibility.
        
        Args:
            filters: Query filters used
            row_count: Total number of rows exported
            
        Returns:
            Manifest dictionary
        """
        return {
            'generation_timestamp': datetime.now(UTC).isoformat(),
            'query_params': {
                'start_date': filters.get('start'),
                'end_date': filters.get('end'),
                'rooms': filters.get('rooms', []),
                'metrics': filters.get('metrics', ['co2', 'temp', 'humidity']),
            },
            'row_count': row_count,
            'version': '1.0',
            'exported_by': 'Cognitiv DataLab'
        }
    
    def _calculate_delta_co2(self, readings: List[Dict], room_id: str) -> List[Dict]:
        """
        Calculate delta CO2 (change from previous reading) for a room.
        
        Args:
            readings: List of reading dictionaries
            room_id: Room identifier
            
        Returns:
            Readings with delta_co2 field added
        """
        enriched_readings = []
        prev_co2 = None
        
        for reading in readings:
            current_co2 = reading.get('co2')
            delta_co2 = None
            
            if current_co2 is not None and prev_co2 is not None:
                delta_co2 = current_co2 - prev_co2
            
            enriched_reading = {**reading, 'delta_co2': delta_co2}
            enriched_readings.append(enriched_reading)
            
            prev_co2 = current_co2
        
        return enriched_readings
    
    def export_stream(self, filters: Dict, format: str = 'csv') -> Generator[bytes, None, None]:
        """
        Stream exported data in specified format.
        
        Args:
            filters: Dict with 'start', 'end', 'rooms' (optional)
            format: 'csv', 'jsonl', or 'pdf'
            
        Yields:
            Bytes of exported data
        """
        # Dispatch to format-specific method
        if format == 'csv':
            yield from self._export_csv(filters)
        elif format == 'jsonl':
            yield from self._export_jsonl(filters)
        elif format == 'pdf':
            yield from self._export_pdf(filters)
        else:
            raise ValueError(f"Unsupported export format: {format}")
    
    def _export_csv(self, filters: Dict) -> Generator[bytes, None, None]:
        """Export data as CSV with manifest header."""
        try:
            pipeline = self.qb.build_pipeline(filters)
            pipeline.append({'$sort': {'bucket_start': 1}})
            
            collection = get_annotated_readings_collection()
            cursor = collection.aggregate(pipeline)
            
        except ValueError:
            return

        output = io.StringIO()
        writer = csv.writer(output)
        
        # Generate and write manifest as comments
        manifest = self._generate_manifest(filters)
        output.write(f"# Cognitiv DataLab Export\n")
        output.write(f"# Generated: {manifest['generation_timestamp']}\n")
        output.write(f"# Query: {json.dumps(manifest['query_params'])}\n")
        output.write(f"#\n")
        
        yield output.getvalue().encode('utf-8')
        output.seek(0)
        output.truncate(0)
        
        # Header
        header = [
            'timestamp', 'room_id', 'device_mac', 
            'co2', 'temp', 'humidity',
            'delta_co2',
            'weather_temp_c', 'weather_humidity',
            'lesson_subject', 'lesson_occupancy_est'
        ]
        
        writer.writerow(header)
        yield output.getvalue().encode('utf-8')
        output.seek(0)
        output.truncate(0)
        
        # Weather cache
        weather_cache = {}
        
        # Track previous CO2 per room for delta calculation
        room_prev_co2 = {}
        
        for bucket in cursor:
            room_id = bucket.get('room_id')
            device_mac = bucket.get('device_mac')
            readings = bucket.get('readings', [])
            context = bucket.get('context', {})
            lesson_ctx = context.get('lesson', {})
            occupancy_est = lesson_ctx.get('estimated_occupancy', 0)
            
            # Calculate delta CO2 for this bucket's readings
            enriched_readings = self._calculate_delta_co2(readings, room_id)
            
            for reading in enriched_readings:
                ts = reading.get('ts')
                if isinstance(ts, str):
                    try:
                        ts = datetime.fromisoformat(ts).replace(tzinfo=UTC)
                    except:
                        pass
                
                # Fetch Weather
                weather_temp = None
                weather_hum = None
                
                if isinstance(ts, datetime):
                    hour_key = ts.replace(minute=0, second=0, microsecond=0)
                    
                    if hour_key not in weather_cache:
                        w_data = self.weather_svc.get_weather_for_timestamp(hour_key)
                        weather_cache[hour_key] = w_data
                    
                    w_entry = weather_cache.get(hour_key)
                    if w_entry:
                        weather_temp = w_entry.get('temp_c')
                        weather_hum = w_entry.get('humidity_rel')
                
                row = [
                    ts.isoformat() if isinstance(ts, datetime) else ts,
                    room_id,
                    device_mac,
                    reading.get('co2'),
                    reading.get('temp'),
                    reading.get('humidity'),
                    reading.get('delta_co2'),
                    weather_temp,
                    weather_hum,
                    reading.get('subject'),
                    occupancy_est
                ]
                
                writer.writerow(row)
                yield output.getvalue().encode('utf-8')
                output.seek(0)
                output.truncate(0)
    
    def _export_jsonl(self, filters: Dict) -> Generator[bytes, None, None]:
        """Export data as JSON Lines with manifest as first line."""
        try:
            pipeline = self.qb.build_pipeline(filters)
            pipeline.append({'$sort': {'bucket_start': 1}})
            
            collection = get_annotated_readings_collection()
            cursor = collection.aggregate(pipeline)
            
        except ValueError:
            return

        # First line: Manifest
        manifest = self._generate_manifest(filters)
        manifest_line = json.dumps({'manifest': manifest}) + '\n'
        yield manifest_line.encode('utf-8')
        
        # Weather cache
        weather_cache = {}
        
        for bucket in cursor:
            room_id = bucket.get('room_id')
            device_mac = bucket.get('device_mac')
            readings = bucket.get('readings', [])
            context = bucket.get('context', {})
            lesson_ctx = context.get('lesson', {})
            occupancy_est = lesson_ctx.get('estimated_occupancy', 0)
            
            # Calculate delta CO2
            enriched_readings = self._calculate_delta_co2(readings, room_id)
            
            for reading in enriched_readings:
                ts = reading.get('ts')
                if isinstance(ts, str):
                    try:
                        ts = datetime.fromisoformat(ts).replace(tzinfo=UTC)
                    except:
                        pass
                
                # Fetch Weather
                weather_temp = None
                weather_hum = None
                
                if isinstance(ts, datetime):
                    hour_key = ts.replace(minute=0, second=0, microsecond=0)
                    
                    if hour_key not in weather_cache:
                        w_data = self.weather_svc.get_weather_for_timestamp(hour_key)
                        weather_cache[hour_key] = w_data
                    
                    w_entry = weather_cache.get(hour_key)
                    if w_entry:
                        weather_temp = w_entry.get('temp_c')
                        weather_hum = w_entry.get('humidity_rel')
                
                record = {
                    'timestamp': ts.isoformat() if isinstance(ts, datetime) else ts,
                    'room_id': room_id,
                    'device_mac': device_mac,
                    'co2': reading.get('co2'),
                    'temp': reading.get('temp'),
                    'humidity': reading.get('humidity'),
                    'delta_co2': reading.get('delta_co2'),
                    'weather': {
                        'temp_c': weather_temp,
                        'humidity_rel': weather_hum
                    },
                    'lesson': {
                        'subject': reading.get('subject'),
                        'estimated_occupancy': occupancy_est
                    }
                }
                
                json_line = json.dumps(record) + '\n'
                yield json_line.encode('utf-8')
    
    def _export_pdf(self, filters: Dict) -> Generator[bytes, None, None]:
        """
        Export data as PDF report with charts and visualizations.
        Uses WeasyPrint on Linux or ReportLab on Windows.
        """
        if not WEASYPRINT_AVAILABLE and not REPORTLAB_AVAILABLE:
            # Fallback: generate a simple text PDF or error message
            error_msg = "PDF generation not available. Please install weasyprint (Linux) or reportlab (Windows)."
            yield error_msg.encode('utf-8')
            return
        
        try:
            pipeline = self.qb.build_pipeline(filters)
            pipeline.append({'$sort': {'bucket_start': 1}})
            
            collection = get_annotated_readings_collection()
            cursor = collection.aggregate(pipeline)
            
        except ValueError:
            return

        # Collect data for visualization
        data_by_room = {}
        weather_cache = {}
        
        for bucket in cursor:
            room_id = bucket.get('room_id')
            readings = bucket.get('readings', [])
            
            if room_id not in data_by_room:
                data_by_room[room_id] = {
                    'timestamps': [],
                    'co2': [],
                    'temp': [],
                    'humidity': [],
                    'weather_temp': [],
                    'occupancy': []
                }
            
            context = bucket.get('context', {})
            lesson_ctx = context.get('lesson', {})
            occupancy_est = lesson_ctx.get('estimated_occupancy', 0)
            
            for reading in readings:
                ts = reading.get('ts')
                if isinstance(ts, str):
                    try:
                        ts = datetime.fromisoformat(ts).replace(tzinfo=UTC)
                    except:
                        continue
                
                # Fetch weather
                weather_temp = None
                if isinstance(ts, datetime):
                    hour_key = ts.replace(minute=0, second=0, microsecond=0)
                    if hour_key not in weather_cache:
                        w_data = self.weather_svc.get_weather_for_timestamp(hour_key)
                        weather_cache[hour_key] = w_data
                    w_entry = weather_cache.get(hour_key)
                    if w_entry:
                        weather_temp = w_entry.get('temp_c')
                
                data_by_room[room_id]['timestamps'].append(ts)
                data_by_room[room_id]['co2'].append(reading.get('co2'))
                data_by_room[room_id]['temp'].append(reading.get('temp'))
                data_by_room[room_id]['humidity'].append(reading.get('humidity'))
                data_by_room[room_id]['weather_temp'].append(weather_temp)
                data_by_room[room_id]['occupancy'].append(occupancy_est)
        
        # Use appropriate PDF generator
        if WEASYPRINT_AVAILABLE:
            # Generate HTML with embedded charts
            html_content = self._generate_pdf_html(filters, data_by_room)
            
            # Convert to PDF
            font_config = FontConfiguration()
            pdf_bytes = HTML(string=html_content).write_pdf(font_config=font_config)
            
            yield pdf_bytes
        
        elif REPORTLAB_AVAILABLE:
            # Use ReportLab for Windows
            pdf_bytes = self._generate_reportlab_pdf(filters, data_by_room)
            yield pdf_bytes

    
    def _generate_pdf_html(self, filters: Dict, data_by_room: Dict) -> str:
        """Generate HTML content for PDF report with Plotly charts."""
        manifest = self._generate_manifest(filters, sum(len(d['timestamps']) for d in data_by_room.values()))
        
        # Create Plotly figures and convert to static images
        charts_html = []
        
        # Chart 1: CO2 Trends by Room
        fig_co2 = go.Figure()
        for room_id, data in data_by_room.items():
            fig_co2.add_trace(go.Scatter(
                x=data['timestamps'],
                y=data['co2'],
                mode='lines',
                name=f'Room {room_id}',
                line=dict(width=2)
            ))
        
        fig_co2.update_layout(
            title='CO2 Levels Over Time',
            xaxis_title='Timestamp',
            yaxis_title='CO2 (ppm)',
            height=400,
            template='plotly_white'
        )
        charts_html.append(fig_co2.to_html(full_html=False, include_plotlyjs='cdn'))
        
        # Chart 2: Temperature vs Weather Correlation
        fig_temp = make_subplots(specs=[[{"secondary_y": True}]])
        
        for room_id, data in list(data_by_room.items())[:3]:  # Limit to 3 rooms for readability
            fig_temp.add_trace(
                go.Scatter(x=data['timestamps'], y=data['temp'], name=f'{room_id} Indoor', mode='lines'),
                secondary_y=False,
            )
            fig_temp.add_trace(
                go.Scatter(x=data['timestamps'], y=data['weather_temp'], name=f'{room_id} Outdoor', 
                          mode='lines', line=dict(dash='dash')),
                secondary_y=False,
            )
        
        fig_temp.update_layout(
            title='Indoor vs Outdoor Temperature',
            xaxis_title='Timestamp',
            height=400,
            template='plotly_white'
        )
        fig_temp.update_yaxes(title_text='Temperature (°C)', secondary_y=False)
        charts_html.append(fig_temp.to_html(full_html=False, include_plotlyjs='cdn'))
        
        # Chart 3: Occupancy Correlation (CO2 vs Estimated Occupancy)
        fig_occupancy = go.Figure()
        for room_id, data in data_by_room.items():
            valid_indices = [i for i, occ in enumerate(data['occupancy']) if occ and occ > 0 and data['co2'][i]]
            if valid_indices:
                fig_occupancy.add_trace(go.Scatter(
                    x=[data['occupancy'][i] for i in valid_indices],
                    y=[data['co2'][i] for i in valid_indices],
                    mode='markers',
                    name=f'Room {room_id}',
                    marker=dict(size=8, opacity=0.6)
                ))
        
        fig_occupancy.update_layout(
            title='CO2 Levels vs Occupancy',
            xaxis_title='Estimated Occupancy',
            yaxis_title='CO2 (ppm)',
            height=400,
            template='plotly_white'
        )
        charts_html.append(fig_occupancy.to_html(full_html=False, include_plotlyjs='cdn'))
        
        # Build complete HTML
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Cognitiv DataLab Report</title>
            <style>
                @page {{
                    size: A4;
                    margin: 2cm;
                }}
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                }}
                h1 {{
                    color: #1a1a1a;
                    border-bottom: 3px solid #3b82f6;
                    padding-bottom: 10px;
                }}
                h2 {{
                    color: #4b5563;
                    margin-top: 30px;
                }}
                .metadata {{
                    background: #f3f4f6;
                    padding: 15px;
                    border-radius: 5px;
                    margin: 20px 0;
                }}
                .metadata p {{
                    margin: 5px 0;
                }}
                .chart {{
                    page-break-inside: avoid;
                    margin: 20px 0;
                }}
                table {{
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                }}
                th, td {{
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: left;
                }}
                th {{
                    background-color: #3b82f6;
                    color: white;
                }}
            </style>
        </head>
        <body>
            <h1>Cognitiv Air Quality Report</h1>
            
            <div class="metadata">
                <h2>Report Metadata</h2>
                <p><strong>Generated:</strong> {manifest['generation_timestamp']}</p>
                <p><strong>Date Range:</strong> {manifest['query_params']['start_date']} to {manifest['query_params']['end_date']}</p>
                <p><strong>Rooms:</strong> {', '.join(manifest['query_params']['rooms']) if manifest['query_params']['rooms'] else 'All'}</p>
                <p><strong>Total Records:</strong> {manifest['row_count']}</p>
            </div>
            
            <h2>Visual Analysis</h2>
            
            {''.join(f'<div class="chart">{chart}</div>' for chart in charts_html)}
            
            <h2>Summary Statistics</h2>
            <table>
                <thead>
                    <tr>
                        <th>Room ID</th>
                        <th>Avg CO2 (ppm)</th>
                        <th>Max CO2 (ppm)</th>
                        <th>Avg Temp (°C)</th>
                        <th>Data Points</th>
                    </tr>
                </thead>
                <tbody>
        """
        
        for room_id, data in data_by_room.items():
            co2_values = [v for v in data['co2'] if v is not None]
            temp_values = [v for v in data['temp'] if v is not None]
            
            avg_co2 = sum(co2_values) / len(co2_values) if co2_values else 0
            max_co2 = max(co2_values) if co2_values else 0
            avg_temp = sum(temp_values) / len(temp_values) if temp_values else 0
            
            html += f"""
                    <tr>
                        <td>{room_id}</td>
                        <td>{avg_co2:.1f}</td>
                        <td>{max_co2:.1f}</td>
                        <td>{avg_temp:.1f}</td>
                        <td>{len(data['timestamps'])}</td>
                    </tr>
            """
        
        html += """
                </tbody>
            </table>
        </body>
        </html>
        """
        
        return html
    
    def _generate_reportlab_pdf(self, filters: Dict, data_by_room: Dict) -> bytes:
        """Generate PDF using ReportLab (Windows fallback)."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        story = []
        styles = getSampleStyleSheet()
        
        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1a1a1a'),
            spaceAfter=30,
        )
        story.append(Paragraph("Cognitiv Air Quality Report", title_style))
        story.append(Spacer(1, 0.2 * inch))
        
        # Metadata
        manifest = self._generate_manifest(filters, sum(len(d['timestamps']) for d in data_by_room.values()))
        
        metadata_data = [
            ['Generated:', manifest['generation_timestamp']],
            ['Date Range:', f"{manifest['query_params']['start_date']} to {manifest['query_params']['end_date']}"],
            ['Rooms:', ', '.join(manifest['query_params']['rooms']) if manifest['query_params']['rooms'] else 'All'],
            ['Total Records:', str(manifest['row_count'])],
        ]
        
        metadata_table = Table(metadata_data, colWidths=[2*inch, 4*inch])
        metadata_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f3f4f6')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        
        story.append(metadata_table)
        story.append(Spacer(1, 0.5 * inch))
        
        # Summary Statistics Table
        story.append(Paragraph("Summary Statistics", styles['Heading2']))
        story.append(Spacer(1, 0.2 * inch))
        
        table_data = [['Room ID', 'Avg CO2 (ppm)', 'Max CO2 (ppm)', 'Avg Temp (°C)', 'Data Points']]
        
        for room_id, data in data_by_room.items():
            co2_values = [v for v in data['co2'] if v is not None]
            temp_values = [v for v in data['temp'] if v is not None]
            
            avg_co2 = sum(co2_values) / len(co2_values) if co2_values else 0
            max_co2 = max(co2_values) if co2_values else 0
            avg_temp = sum(temp_values) / len(temp_values) if temp_values else 0
            
            table_data.append([
                room_id,
                f'{avg_co2:.1f}',
                f'{max_co2:.1f}',
                f'{avg_temp:.1f}',
                str(len(data['timestamps']))
            ])
        
        stats_table = Table(table_data, colWidths=[1.5*inch, 1.5*inch, 1.5*inch, 1.5*inch, 1.5*inch])
        stats_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3b82f6')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        
        story.append(stats_table)
        
        # Build PDF
        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        return pdf_bytes