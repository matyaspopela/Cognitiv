"""
PDF Report Templates for DataLab

Provides professional PDF templates for different audiences:
- TeacherSummaryTemplate: Classroom-focused insights
- PrincipalReportTemplate: Executive summary for administration
"""

from typing import Dict, List
from datetime import datetime
from io import BytesIO

try:
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


class TeacherSummaryTemplate:
    """
    PDF template for teacher-focused classroom air quality reports.
    
    Includes:
    - Room-specific metrics
    - Lesson-by-lesson breakdown
    - Actionable ventilation recommendations
    - Mold risk alerts
    """
    
    def __init__(self, room_id: str, teacher_name: str, date_range: tuple):
        self.room_id = room_id
        self.teacher_name = teacher_name
        self.date_range = date_range
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
    
    def _setup_custom_styles(self):
        """Create custom paragraph styles."""
        self.styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1f2937'),
            spaceAfter=30,
            alignment=TA_CENTER
        ))
        
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#3b82f6'),
            spaceBefore=20,
            spaceAfter=12,
            borderWidth=0,
            borderColor=colors.HexColor('#3b82f6'),
            borderPadding=5
        ))
        
        self.styles.add(ParagraphStyle(
            name='Recommendation',
            parent=self.styles['Normal'],
            fontSize=11,
            leftIndent=20,
            bulletIndent=10,
            spaceAfter=8
        ))
    
    def generate(self, data: Dict) -> bytes:
        """
        Generate PDF report.
        
        Args:
            data: Dictionary with keys:
                - avg_co2: Average CO2 level
                - max_co2: Maximum CO2 level
                - avg_temp: Average temperature
                - avg_humidity: Average humidity
                - mold_risk_level: Mold risk classification
                - lessons: List of lesson summaries
                - recommendations: List of action items
        
        Returns:
            PDF bytes
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.75*inch, bottomMargin=0.75*inch)
        story = []
        
        # Title
        title = Paragraph(f"Air Quality Report: {self.room_id}", self.styles['CustomTitle'])
        story.append(title)
        
        # Metadata
        meta_text = f"<b>Teacher:</b> {self.teacher_name}<br/>"
        meta_text += f"<b>Period:</b> {self.date_range[0]} to {self.date_range[1]}<br/>"
        meta_text += f"<b>Generated:</b> {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        story.append(Paragraph(meta_text, self.styles['Normal']))
        story.append(Spacer(1, 0.3*inch))
        
        # Summary Metrics Table
        story.append(Paragraph("Summary Metrics", self.styles['SectionHeader']))
        
        metrics_data = [
            ['Metric', 'Value', 'Status'],
            ['Average CO₂', f"{data.get('avg_co2', 0):.0f} ppm", self._get_co2_status(data.get('avg_co2', 0))],
            ['Peak CO₂', f"{data.get('max_co2', 0):.0f} ppm", self._get_co2_status(data.get('max_co2', 0))],
            ['Average Temperature', f"{data.get('avg_temp', 0):.1f}°C", '✓'],
            ['Average Humidity', f"{data.get('avg_humidity', 0):.1f}%", '✓'],
            ['Mold Risk', data.get('mold_risk_level', 'NONE'), self._get_mold_status(data.get('mold_risk_level', 'NONE'))]
        ]
        
        metrics_table = Table(metrics_data, colWidths=[2.5*inch, 2*inch, 1.5*inch])
        metrics_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3b82f6')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey])
        ]))
        story.append(metrics_table)
        story.append(Spacer(1, 0.3*inch))
        
        # Recommendations
        story.append(Paragraph("Recommendations", self.styles['SectionHeader']))
        recommendations = data.get('recommendations', [])
        
        if not recommendations:
            recommendations = self._generate_recommendations(data)
        
        for rec in recommendations:
            story.append(Paragraph(f"• {rec}", self.styles['Recommendation']))
        
        story.append(Spacer(1, 0.3*inch))
        
        # Lesson Breakdown (if available)
        lessons = data.get('lessons', [])
        if lessons:
            story.append(Paragraph("Lesson-by-Lesson Breakdown", self.styles['SectionHeader']))
            
            lesson_data = [['Period', 'Subject', 'Avg CO₂', 'Peak CO₂', 'Ventilation']]
            for lesson in lessons[:10]:  # Limit to 10 lessons
                lesson_data.append([
                    f"Period {lesson.get('period', 'N/A')}",
                    lesson.get('subject', 'Unknown'),
                    f"{lesson.get('avg_co2', 0):.0f}",
                    f"{lesson.get('max_co2', 0):.0f}",
                    '✓' if lesson.get('avg_co2', 0) < 1000 else '⚠'
                ])
            
            lesson_table = Table(lesson_data, colWidths=[1*inch, 2*inch, 1.2*inch, 1.2*inch, 1*inch])
            lesson_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#10b981')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 11),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                ('GRID', (0, 0), (-1, -1), 1, colors.grey),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey])
            ]))
            story.append(lesson_table)
        
        # Build PDF
        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        return pdf_bytes
    
    def _get_co2_status(self, co2: float) -> str:
        """Get status indicator for CO2 level."""
        if co2 < 800:
            return '✓ Good'
        elif co2 < 1000:
            return '⚠ Fair'
        elif co2 < 1400:
            return '⚠ Poor'
        else:
            return '✗ Critical'
    
    def _get_mold_status(self, risk_level: str) -> str:
        """Get status indicator for mold risk."""
        risk_map = {
            'NONE': '✓ Safe',
            'LOW': '✓ Low',
            'MODERATE': '⚠ Moderate',
            'HIGH': '⚠ High',
            'CRITICAL': '✗ Critical'
        }
        return risk_map.get(risk_level.upper(), '?')
    
    def _generate_recommendations(self, data: Dict) -> List[str]:
        """Generate actionable recommendations based on data."""
        recommendations = []
        
        avg_co2 = data.get('avg_co2', 0)
        max_co2 = data.get('max_co2', 0)
        mold_risk = data.get('mold_risk_level', 'NONE').upper()
        
        # CO2 recommendations
        if avg_co2 > 1000:
            recommendations.append("Open windows for 5-10 minutes between lessons to reduce CO₂ levels.")
        if max_co2 > 1400:
            recommendations.append("Consider using mechanical ventilation during lessons with high occupancy.")
        
        # Mold recommendations
        if mold_risk in ['HIGH', 'CRITICAL']:
            recommendations.append("High mold risk detected. Increase ventilation immediately and check for moisture sources.")
        elif mold_risk == 'MODERATE':
            recommendations.append("Monitor humidity levels and ensure regular air circulation.")
        
        # General recommendations
        if avg_co2 < 800:
            recommendations.append("Excellent air quality! Continue current ventilation practices.")
        
        if not recommendations:
            recommendations.append("Air quality is within acceptable limits. Maintain regular ventilation.")
        
        return recommendations


class PrincipalReportTemplate:
    """
    PDF template for principal/administration executive summary.
    
    Includes:
    - School-wide statistics
    - Room-by-room comparison
    - Compliance metrics
    - Budget recommendations
    """
    
    def __init__(self, school_name: str, date_range: tuple):
        self.school_name = school_name
        self.date_range = date_range
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
    
    def _setup_custom_styles(self):
        """Create custom paragraph styles."""
        self.styles.add(ParagraphStyle(
            name='ExecutiveTitle',
            parent=self.styles['Heading1'],
            fontSize=26,
            textColor=colors.HexColor('#1f2937'),
            spaceAfter=20,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        ))
        
        self.styles.add(ParagraphStyle(
            name='ExecutiveSection',
            parent=self.styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#7c2d12'),
            spaceBefore=15,
            spaceAfter=10
        ))
    
    def generate(self, data: Dict) -> bytes:
        """
        Generate executive summary PDF.
        
        Args:
            data: Dictionary with keys:
                - total_rooms: Number of monitored rooms
                - avg_co2_school: School-wide average CO2
                - compliance_rate: % of time within limits
                - rooms_at_risk: Number of rooms with issues
                - room_summaries: List of room statistics
                - budget_recommendations: List of investment suggestions
        
        Returns:
            PDF bytes
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=inch, bottomMargin=inch)
        story = []
        
        # Title
        title = Paragraph(f"Air Quality Executive Summary<br/>{self.school_name}", self.styles['ExecutiveTitle'])
        story.append(title)
        
        # Date range
        date_text = f"<i>Reporting Period: {self.date_range[0]} to {self.date_range[1]}</i>"
        story.append(Paragraph(date_text, self.styles['Normal']))
        story.append(Spacer(1, 0.4*inch))
        
        # Key Performance Indicators
        story.append(Paragraph("Key Performance Indicators", self.styles['ExecutiveSection']))
        
        kpi_data = [
            ['Metric', 'Value', 'Target', 'Status'],
            ['Monitored Rooms', str(data.get('total_rooms', 0)), 'N/A', '✓'],
            ['School Avg CO₂', f"{data.get('avg_co2_school', 0):.0f} ppm", '< 1000 ppm', 
             '✓' if data.get('avg_co2_school', 0) < 1000 else '✗'],
            ['Compliance Rate', f"{data.get('compliance_rate', 0):.1f}%", '> 90%',
             '✓' if data.get('compliance_rate', 0) > 90 else '✗'],
            ['Rooms at Risk', str(data.get('rooms_at_risk', 0)), '0',
             '✓' if data.get('rooms_at_risk', 0) == 0 else '⚠']
        ]
        
        kpi_table = Table(kpi_data, colWidths=[2.5*inch, 1.5*inch, 1.5*inch, 1*inch])
        kpi_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7c2d12')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey])
        ]))
        story.append(kpi_table)
        story.append(Spacer(1, 0.3*inch))
        
        # Budget Recommendations
        story.append(Paragraph("Investment Recommendations", self.styles['ExecutiveSection']))
        
        budget_recs = data.get('budget_recommendations', [
            "Consider installing CO₂ sensors in all classrooms for continuous monitoring.",
            "Upgrade HVAC systems in rooms with persistent high CO₂ levels.",
            "Implement automated ventilation controls to reduce manual intervention."
        ])
        
        for rec in budget_recs:
            story.append(Paragraph(f"• {rec}", self.styles['Normal']))
        
        # Build PDF
        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        return pdf_bytes


def generate_teacher_report(room_id: str, teacher_name: str, date_range: tuple, data: Dict) -> bytes:
    """Convenience function to generate teacher report."""
    if not REPORTLAB_AVAILABLE:
        raise ImportError("ReportLab is required for PDF generation")
    
    template = TeacherSummaryTemplate(room_id, teacher_name, date_range)
    return template.generate(data)


def generate_principal_report(school_name: str, date_range: tuple, data: Dict) -> bytes:
    """Convenience function to generate principal report."""
    if not REPORTLAB_AVAILABLE:
        raise ImportError("ReportLab is required for PDF generation")
    
    template = PrincipalReportTemplate(school_name, date_range)
    return template.generate(data)
