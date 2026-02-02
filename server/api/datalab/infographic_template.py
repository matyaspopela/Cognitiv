"""
Infographic-Style PDF Template for DataLab

Modern, data-visualization-focused PDF export matching DataLab's minimalist aesthetic.

Features:
- Clean minimalist design (black/white palette)
- "Hall of Shame" CO2 rankings by subject/room/teacher
- Weekly trend sparklines
- AQI placeholder for future integration
- Designed for executive/administrator audience
"""

from typing import Dict, List, Optional
from datetime import datetime, timedelta
from io import BytesIO
import math

try:
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib.units import inch, cm
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Paragraph, 
        Spacer, PageBreak, Image, KeepTogether
    )
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from reportlab.graphics.shapes import Drawing, Line, Rect, Circle
    from reportlab.graphics import renderPDF
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


class InfographicPDFTemplate:
    """
    Modern infographic-style PDF template for DataLab exports.
    
    Design Philosophy:
    - Minimalist black/white aesthetic (matching UI)
    - Data-first approach
    - Clear hierarchical typography
    - Visual CO2 severity indicators
    """
    
    def __init__(self, date_range: tuple, school_name: str = "Your School"):
        self.date_range = date_range
        self.school_name = school_name
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
        
        # CO2 thresholds (matching frontend theme)
        self.co2_thresholds = {
            'safe': 800,      # < 800 ppm
            'warning': 1200,  # 800-1200 ppm
            'critical': 1200  # > 1200 ppm
        }
    
    def _setup_custom_styles(self):
        """Create minimalist custom paragraph styles."""
        # Main title - Bold, large, black
        self.styles.add(ParagraphStyle(
            name='InfographicTitle',
            parent=self.styles['Heading1'],
            fontSize=28,
            textColor=colors.black,
            spaceAfter=6,
            alignment=TA_LEFT,
            fontName='Helvetica-Bold'
        ))
        
        # Section headers - Medium, uppercase
        self.styles.add(ParagraphStyle(
            name='InfographicSection',
            parent=self.styles['Heading2'],
            fontSize=14,
            textColor=colors.black,
            spaceBefore=20,
            spaceAfter=12,
            fontName='Helvetica-Bold',
            leftIndent=0
        ))
        
        # Subtitle - Gray, smaller
        self.styles.add(ParagraphStyle(
            name='InfographicSubtitle',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#71717a'),  # zinc-500
            spaceAfter=20,
            alignment=TA_LEFT
        ))
        
        # Metric labels
        self.styles.add(ParagraphStyle(
            name='MetricLabel',
            parent=self.styles['Normal'],
            fontSize=9,
            textColor=colors.HexColor('#71717a'),
            spaceAfter=2,
            fontName='Helvetica'
        ))
        
        # Metric values - Large, bold
        self.styles.add(ParagraphStyle(
            name='MetricValue',
            parent=self.styles['Normal'],
            fontSize=24,
            textColor=colors.black,
            spaceAfter=0,
            fontName='Helvetica-Bold'
        ))
    
    def generate(self, data: Dict) -> bytes:
        """
        Generate infographic PDF.
        
        Args:
            data: Dictionary with:
                - hall_of_shame: List[Dict] - CO2 rankings
                - weekly_trends: Dict[str, List[float]] - Daily averages
                - summary_stats: Dict - Overall statistics
                - aqi_value: Optional[int] - AQI placeholder
        
        Returns:
            PDF bytes
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer, 
            pagesize=A4, 
            topMargin=1*inch, 
            bottomMargin=1*inch,
            leftMargin=0.75*inch,
            rightMargin=0.75*inch
        )
        story = []
        
        # === HEADER ===
        story.extend(self._build_header(data))
        
        # === KEY METRICS ===
        story.extend(self._build_key_metrics(data.get('summary_stats', {})))
        
        # === HALL OF SHAME ===
        hall_of_shame = data.get('hall_of_shame', [])
        if hall_of_shame:
            story.extend(self._build_hall_of_shame(hall_of_shame))
        
        # === WEEKLY TRENDS (SPARKLINES) ===
        weekly_trends = data.get('weekly_trends', {})
        if weekly_trends:
            story.extend(self._build_weekly_trends(weekly_trends))
        
        # Build PDF
        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        return pdf_bytes
    
    def _build_header(self, data: Dict) -> List:
        """Build minimalist header with title, date range, and AQI placeholder."""
        elements = []
        
        # Title
        elements.append(Paragraph("Air Quality Report", self.styles['InfographicTitle']))
        
        # Subtitle with date range and AQI placeholder
        start_date, end_date = self.date_range
        aqi_value = data.get('aqi_value', 'N/A')
        subtitle_text = f"{start_date} to {end_date} &nbsp;&nbsp;|&nbsp;&nbsp; AQI: {aqi_value}"
        elements.append(Paragraph(subtitle_text, self.styles['InfographicSubtitle']))
        
        # Divider line
        elements.append(Spacer(1, 0.1*inch))
        
        return elements
    
    def _build_key_metrics(self, stats: Dict) -> List:
        """Build key metrics overview (avg CO2, peak CO2, rooms monitored)."""
        elements = []
        
        # Create metrics cards in a table layout
        metrics_data = []
        
        # Row 1: Labels
        metrics_data.append([
            Paragraph("Average CO2", self.styles['MetricLabel']),
            Paragraph("Peak CO2", self.styles['MetricLabel']),
            Paragraph("Rooms Monitored", self.styles['MetricLabel'])
        ])
        
        # Row 2: Values
        avg_co2 = stats.get('avg_co2', 0)
        max_co2 = stats.get('max_co2', 0)
        total_rooms = stats.get('total_rooms', 0)
        
        metrics_data.append([
            Paragraph(f"{avg_co2:.0f} <font size=16>ppm</font>", self.styles['MetricValue']),
            Paragraph(f"{max_co2:.0f} <font size=16>ppm</font>", self.styles['MetricValue']),
            Paragraph(f"{total_rooms}", self.styles['MetricValue'])
        ])
        
        # Row 3: Status indicators
        avg_status = self._get_co2_status_text(avg_co2)
        peak_status = self._get_co2_status_text(max_co2)
        
        metrics_data.append([
            Paragraph(avg_status, self.styles['MetricLabel']),
            Paragraph(peak_status, self.styles['MetricLabel']),
            Paragraph("", self.styles['MetricLabel'])
        ])
        
        metrics_table = Table(metrics_data, colWidths=[2.2*inch, 2.2*inch, 2.2*inch])
        metrics_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            # Minimal borders (top only for separation)
            ('LINEABOVE', (0, 0), (-1, 0), 0.5, colors.HexColor('#e5e7eb')),
            ('LINEBELOW', (0, -1), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
        ]))
        
        elements.append(metrics_table)
        elements.append(Spacer(1, 0.3*inch))
        
        return elements
    
    def _build_hall_of_shame(self, rankings: List[Dict]) -> List:
        """
        Build "Hall of Shame" ranking table.
        
        Args:
            rankings: List of dicts with 'name', 'avg_co2', 'max_co2', 'type' (subject/room/teacher)
        """
        elements = []
        
        elements.append(Paragraph("Hall of Shame: Highest CO₂ Levels", self.styles['InfographicSection']))
        elements.append(Spacer(1, 0.1*inch))
        
        # Build table data
        table_data = [['Rank', 'Subject / Room / Teacher', 'Avg CO₂', 'Peak CO₂', '']]
        
        for idx, entry in enumerate(rankings[:10], 1):  # Top 10
            name = entry.get('name', 'Unknown')
            avg_co2 = entry.get('avg_co2', 0)
            max_co2 = entry.get('max_co2', 0)
            
            # Status icon
            status_icon = self._get_co2_status_icon(avg_co2)
            
            table_data.append([
                f"#{idx}",
                name,
                f"{avg_co2:.0f} ppm",
                f"{max_co2:.0f} ppm",
                status_icon
            ])
        
        hall_table = Table(table_data, colWidths=[0.5*inch, 2.5*inch, 1.5*inch, 1.5*inch, 0.6*inch])
        hall_table.setStyle(TableStyle([
            # Header row
            ('BACKGROUND', (0, 0), (-1, 0), colors.black),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('TOPPADDING', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            
            # Data rows
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
            ('ALIGN', (0, 0), (0, -1), 'CENTER'),  # Rank
            ('ALIGN', (2, 0), (-1, -1), 'CENTER'),  # CO2 values
            
            # Borders - minimal style
            ('LINEBELOW', (0, 0), (-1, 0), 1, colors.black),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#fafafa')]),
            ('GRID', (0, 1), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
        ]))
        
        elements.append(hall_table)
        elements.append(Spacer(1, 0.4*inch))
        
        return elements
    
    def _build_weekly_trends(self, trends: Dict[str, List[float]]) -> List:
        """
        Build weekly trend sparklines.
        
        Args:
            trends: Dict mapping room/subject name to list of daily average CO2 values
        """
        elements = []
        
        elements.append(Paragraph("Weekly Trends", self.styles['InfographicSection']))
        elements.append(Spacer(1, 0.1*inch))
        
        # Build table with sparklines
        table_data = [['Name', 'Trend (7 Days)', 'Avg', 'Change']]
        
        for name, daily_values in list(trends.items())[:8]:  # Limit to 8 trends
            if not daily_values or len(daily_values) < 2:
                continue
            
            # Calculate stats
            avg_value = sum(daily_values) / len(daily_values)
            change = daily_values[-1] - daily_values[0] if len(daily_values) >= 2 else 0
            change_pct = (change / daily_values[0] * 100) if daily_values[0] != 0 else 0
            
            # Generate sparkline
            sparkline = self._create_sparkline(daily_values, width=2*inch, height=0.4*inch)
            
            # Change indicator
            if change > 0:
                change_text = f"↑ {change_pct:+.1f}%"
                change_color = 'red'
            elif change < 0:
                change_text = f"↓ {change_pct:+.1f}%"
                change_color = 'green'
            else:
                change_text = "→ 0.0%"
                change_color = 'gray'
            
            table_data.append([
                name[:25],  # Truncate long names
                sparkline,
                f"{avg_value:.0f} ppm",
                Paragraph(f'<font color="{change_color}">{change_text}</font>', self.styles['Normal'])
            ])
        
        trends_table = Table(table_data, colWidths=[2*inch, 2.2*inch, 1*inch, 1*inch])
        trends_table.setStyle(TableStyle([
            # Header
            ('BACKGROUND', (0, 0), (-1, 0), colors.black),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('TOPPADDING', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            
            # Data
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
            ('ALIGN', (2, 1), (3, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            
            # Borders
            ('LINEBELOW', (0, 0), (-1, 0), 1, colors.black),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#fafafa')]),
            ('GRID', (0, 1), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
        ]))
        
        elements.append(trends_table)
        
        return elements
    
    def _create_sparkline(self, values: List[float], width: float, height: float) -> Drawing:
        """
        Create a minimalist sparkline chart.
        
        Args:
            values: List of data points
            width: Width in points
            height: Height in points
        
        Returns:
            ReportLab Drawing object
        """
        drawing = Drawing(width, height)
        
        if not values or len(values) < 2:
            return drawing
        
        # Normalize values to chart dimensions
        min_val = min(values)
        max_val = max(values)
        value_range = max_val - min_val if max_val != min_val else 1
        
        # Calculate x step
        x_step = width / (len(values) - 1)
        
        # Draw line
        for i in range(len(values) - 1):
            y1 = ((values[i] - min_val) / value_range) * height
            y2 = ((values[i + 1] - min_val) / value_range) * height
            x1 = i * x_step
            x2 = (i + 1) * x_step
            
            line = Line(x1, y1, x2, y2, strokeColor=colors.black, strokeWidth=1.5)
            drawing.add(line)
        
        # Draw dots at start and end
        y_start = ((values[0] - min_val) / value_range) * height
        y_end = ((values[-1] - min_val) / value_range) * height
        
        drawing.add(Circle(0, y_start, 2, fillColor=colors.black, strokeColor=None))
        drawing.add(Circle(width, y_end, 2, fillColor=colors.black, strokeColor=None))
        
        return drawing
    
    def _get_co2_status_text(self, co2_value: float) -> str:
        """Get status text for CO2 value."""
        if co2_value < self.co2_thresholds['safe']:
            return '<font color="#10B981">✓ Good</font>'
        elif co2_value < self.co2_thresholds['warning']:
            return '<font color="#F59E0B">⚠ Fair</font>'
        else:
            return '<font color="#EF4444">✗ Poor</font>'
    
    def _get_co2_status_icon(self, co2_value: float) -> str:
        """Get status icon for CO2 value."""
        if co2_value < self.co2_thresholds['safe']:
            return '✓'
        elif co2_value < self.co2_thresholds['warning']:
            return '⚠'
        else:
            return '✗'


def generate_infographic_report(date_range: tuple, school_name: str, data: Dict) -> bytes:
    """
    Convenience function to generate infographic PDF report.
    
    Args:
        date_range: Tuple of (start_date, end_date) strings
        school_name: Name of the school
        data: Data dictionary with hall_of_shame, weekly_trends, summary_stats
    
    Returns:
        PDF bytes
    """
    if not REPORTLAB_AVAILABLE:
        raise ImportError("ReportLab is required for PDF generation")
    
    template = InfographicPDFTemplate(date_range, school_name)
    return template.generate(data)
