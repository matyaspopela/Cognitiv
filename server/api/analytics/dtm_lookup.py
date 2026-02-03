"""
Days to Mold (DTM) Lookup Service

Provides DTM values based on Temperature and Relative Humidity using
the IPI (Image Permanence Institute) Dew Point Calculator methodology.

The DTM represents the number of days it takes for mold to germinate
under specific environmental conditions.

Reference: IPI Dew Point Calculator
https://www.dpcalc.org/
"""

from typing import Optional
import math


# DTM Lookup Table
# Based on IPI research data points
# Format: (temp_c, rh_percent): days_to_mold
# This is a simplified approximation based on publicly available IPI data
DTM_TABLE = {
    # Temperature: 5°C
    (5, 70): 180,
    (5, 75): 120,
    (5, 80): 80,
    (5, 85): 50,
    (5, 90): 30,
    (5, 95): 20,
    
    # Temperature: 10°C
    (10, 70): 120,
    (10, 75): 80,
    (10, 80): 50,
    (10, 85): 30,
    (10, 90): 20,
    (10, 95): 12,
    
    # Temperature: 15°C
    (15, 70): 80,
    (15, 75): 50,
    (15, 80): 30,
    (15, 85): 20,
    (15, 90): 12,
    (15, 95): 7,
    
    # Temperature: 20°C
    (20, 70): 50,
    (20, 75): 30,
    (20, 80): 20,
    (20, 85): 12,
    (20, 90): 7,
    (20, 95): 4,
    
    # Temperature: 25°C (optimal for mold)
    (25, 70): 30,
    (25, 75): 20,
    (25, 80): 12,
    (25, 85): 7,
    (25, 90): 4,
    (25, 95): 2,
    
    # Temperature: 30°C
    (30, 70): 40,
    (30, 75): 25,
    (30, 80): 15,
    (30, 85): 9,
    (30, 90): 5,
    (30, 95): 3,
    
    # Temperature: 35°C
    (35, 70): 60,
    (35, 75): 40,
    (35, 80): 25,
    (35, 85): 15,
    (35, 90): 9,
    (35, 95): 5,
}


def _bilinear_interpolate(
    x: float, y: float,
    x1: float, x2: float,
    y1: float, y2: float,
    q11: float, q12: float, q21: float, q22: float
) -> float:
    """
    Perform bilinear interpolation.
    
    Args:
        x, y: Point to interpolate
        x1, x2: X bounds
        y1, y2: Y bounds
        q11, q12, q21, q22: Values at corners (x1,y1), (x1,y2), (x2,y1), (x2,y2)
    
    Returns:
        Interpolated value
    """
    # Avoid division by zero
    if x2 == x1 or y2 == y1:
        return q11
    
    # Bilinear interpolation formula
    return (
        q11 * (x2 - x) * (y2 - y) +
        q21 * (x - x1) * (y2 - y) +
        q12 * (x2 - x) * (y - y1) +
        q22 * (x - x1) * (y - y1)
    ) / ((x2 - x1) * (y2 - y1))


def get_dtm(temp_c: float, rh: float) -> Optional[float]:
    """
    Get Days to Mold (DTM) for given temperature and relative humidity.
    
    Uses bilinear interpolation between known data points from the DTM table.
    Returns None if conditions are outside the mold growth range.
    
    Args:
        temp_c: Temperature in Celsius
        rh: Relative humidity (0-100%)
    
    Returns:
        Days to mold germination, or None if conditions are unfavorable
    """
    # Check if conditions are favorable for mold growth
    # Mold requires: 2°C to 45°C and RH > 65%
    if temp_c < 2 or temp_c > 45 or rh < 65:
        return None
    
    # Clamp to table bounds
    temp_c = max(5, min(35, temp_c))
    rh = max(70, min(95, rh))
    
    # Find surrounding temperature points
    temp_points = [5, 10, 15, 20, 25, 30, 35]
    rh_points = [70, 75, 80, 85, 90, 95]
    
    # Find bounding temperatures
    t1 = max([t for t in temp_points if t <= temp_c], default=5)
    t2 = min([t for t in temp_points if t >= temp_c], default=35)
    
    # Find bounding RH values
    r1 = max([r for r in rh_points if r <= rh], default=70)
    r2 = min([r for r in rh_points if r >= rh], default=95)
    
    # If exact match exists
    if (temp_c, rh) in DTM_TABLE:
        return DTM_TABLE[(temp_c, rh)]
    
    # Get corner values for interpolation
    q11 = DTM_TABLE.get((t1, r1), 180)  # Default to high DTM if missing
    q12 = DTM_TABLE.get((t1, r2), 180)
    q21 = DTM_TABLE.get((t2, r1), 180)
    q22 = DTM_TABLE.get((t2, r2), 180)
    
    # Perform bilinear interpolation
    dtm = _bilinear_interpolate(
        temp_c, rh,
        t1, t2,
        r1, r2,
        q11, q12, q21, q22
    )
    
    return max(1.0, dtm)  # Ensure minimum of 1 day


def is_favorable_for_mold(temp_c: float, rh: float) -> bool:
    """
    Check if conditions are favorable for mold growth.
    
    Args:
        temp_c: Temperature in Celsius
        rh: Relative humidity (0-100%)
    
    Returns:
        True if conditions favor mold growth
    """
    return 2 <= temp_c <= 45 and rh >= 65
