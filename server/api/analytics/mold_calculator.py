"""
Mold Factor Calculator

Calculates mold risk based on temperature, humidity, and exposure time.
Uses a simplified version of the VTT Mold Growth Model.

Reference: VTT Technical Research Centre of Finland
The VTT model calculates mold growth index based on:
- Relative humidity (%)
- Temperature (°C)
- Time of exposure (hours)
- Surface material sensitivity class

Simplified formula for indoor air quality monitoring:
mold_index = (RH - RH_crit) * temp_factor * time_factor

Where:
- RH_crit = Critical relative humidity (typically 80% at 20°C)
- temp_factor = exponential function of temperature
- time_factor = logarithmic function of exposure hours
"""

from typing import Dict, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


class MoldRiskLevel(Enum):
    """Mold risk classification levels."""
    NONE = "none"
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class MoldFactorResult:
    """Result of mold factor calculation."""
    mold_factor: float
    risk_level: MoldRiskLevel
    description: str
    recommendations: list[str]


def calculate_critical_rh(temp_c: float) -> float:
    """
    Calculate critical relative humidity for mold growth.
    
    Based on simplified VTT model:
    At 20°C, RH_crit ≈ 80%
    At 30°C, RH_crit ≈ 75%
    At 10°C, RH_crit ≈ 90%
    At 0°C, RH_crit ≈ 100%
    
    Args:
        temp_c: Temperature in Celsius
        
    Returns:
        Critical RH threshold (%)
    """
    if temp_c < 0:
        return 100.0  # Mold doesn't grow below freezing
    elif temp_c <= 10:
        # Interpolate from 100% at 0°C to 90% at 10°C
        return 100 - temp_c
    elif temp_c <= 20:
        # Interpolate from 90% at 10°C to 80% at 20°C
        return 90 - (temp_c - 10)
    elif temp_c <= 30:
        # Interpolate from 80% at 20°C to 75% at 30°C
        return 80 - (temp_c - 20) * 0.5
    else:
        return 75.0  # Minimum threshold


def calculate_mold_factor(
    humidity_rel: float,
    temp_c: float,
    exposure_hours: float = 1.0,
    surface_sensitivity: float = 1.0
) -> MoldFactorResult:
    """
    Calculate mold growth factor based on environmental conditions.
    
    Args:
        humidity_rel: Relative humidity (0-100%)
        temp_c: Temperature in Celsius
        exposure_hours: Duration of exposure in hours
        surface_sensitivity: Material sensitivity (0.5=resistant, 1.0=normal, 2.0=sensitive)
        
    Returns:
        MoldFactorResult with factor value and risk level
    """
    # Validate inputs
    if humidity_rel is None or temp_c is None:
        return MoldFactorResult(
            mold_factor=0.0,
            risk_level=MoldRiskLevel.NONE,
            description="Insufficient data for mold risk calculation",
            recommendations=[]
        )
    
    # Clamp values to reasonable ranges
    humidity_rel = max(0, min(100, humidity_rel))
    temp_c = max(-10, min(50, temp_c))
    exposure_hours = max(0.1, exposure_hours)
    
    # Calculate critical RH for this temperature
    rh_critical = calculate_critical_rh(temp_c)
    
    # Calculate humidity excess over critical threshold
    rh_excess = max(0, humidity_rel - rh_critical)
    
    # Temperature factor (optimal mold growth 20-30°C)
    # Normalized: 1.0 at 25°C, lower outside optimal range
    if temp_c < 5 or temp_c > 40:
        temp_factor = 0.1  # Minimal growth outside range
    elif temp_c < 15:
        temp_factor = 0.3 + (temp_c - 5) * 0.07
    elif temp_c <= 30:
        temp_factor = 1.0
    else:
        temp_factor = 1.0 - (temp_c - 30) * 0.09
    
    # Time factor (logarithmic - mold needs sustained conditions)
    # Normalized: 1.0 at 24 hours
    import math
    time_factor = math.log(exposure_hours + 1) / math.log(25)
    time_factor = max(0.1, min(2.0, time_factor))
    
    # Calculate mold factor (scale by 0.5 to map to 0-10 range better)
    # At 95% RH, 25°C, 24h: excess=17.5, temp=1.0, time=1.0 → factor = 17.5*1*1*1 / 3.5 = 5.0
    mold_factor = (rh_excess * temp_factor * time_factor * surface_sensitivity) / 3.5
    mold_factor = round(max(0.0, min(10.0, float(mold_factor))), 2)
    
    # Determine risk level and recommendations
    if mold_factor < 0.5:
        risk_level = MoldRiskLevel.NONE
        description = "No mold risk. Conditions are well within safe limits."
        recommendations = []
    elif mold_factor < 2.0:
        risk_level = MoldRiskLevel.LOW
        description = "Low mold risk. Monitor humidity levels."
        recommendations = ["Consider brief ventilation if humidity remains elevated."]
    elif mold_factor < 4.0:
        risk_level = MoldRiskLevel.MODERATE
        description = "Moderate mold risk. Action recommended within 24 hours."
        recommendations = [
            "Open windows to improve ventilation.",
            "Consider using a dehumidifier.",
            "Check for sources of moisture."
        ]
    elif mold_factor < 7.0:
        risk_level = MoldRiskLevel.HIGH
        description = "High mold risk. Immediate action required."
        recommendations = [
            "Ventilate the room immediately.",
            "Use dehumidifier or AC.",
            "Identify and address moisture sources.",
            "Monitor for visible mold growth."
        ]
    else:
        risk_level = MoldRiskLevel.CRITICAL
        description = "Critical mold risk. Urgent intervention needed."
        recommendations = [
            "Evacuate if possible and ventilate thoroughly.",
            "Use industrial dehumidification if available.",
            "Professional inspection may be warranted.",
            "Document conditions for maintenance team."
        ]
    
    return MoldFactorResult(
        mold_factor=mold_factor,
        risk_level=risk_level,
        description=description,
        recommendations=recommendations
    )


def calculate_mold_factor_simple(humidity_rel: float, temp_c: float) -> float:
    """
    Simplified mold factor calculation for batch processing.
    
    Returns a single float value (0-10 scale).
    
    Args:
        humidity_rel: Relative humidity (0-100%)
        temp_c: Temperature in Celsius
        
    Returns:
        Mold factor value (0-10)
    """
    result = calculate_mold_factor(humidity_rel, temp_c)
    return result.mold_factor


def get_risk_level_color(risk_level: MoldRiskLevel) -> str:
    """Get color code for risk level visualization."""
    colors = {
        MoldRiskLevel.NONE: "#10b981",     # Green
        MoldRiskLevel.LOW: "#84cc16",      # Lime
        MoldRiskLevel.MODERATE: "#f59e0b",  # Amber
        MoldRiskLevel.HIGH: "#ef4444",      # Red
        MoldRiskLevel.CRITICAL: "#7c2d12",  # Dark Red
    }
    return colors.get(risk_level, "#71717a")
