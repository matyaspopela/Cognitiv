"""
AQI Calculation Module

Implements the school-specific Air Quality Index (0-100) based on CO2 levels.
Logic approved in aqi_proposal.md (Option 2: School-Specific Piecewise).

Stricter Scale (Revised v2):
- 0-800 ppm: 100 (Excellent)
- 800-1000 ppm: 100 -> 90 (Good)
- 1000-2000 ppm: 90 -> 50 (Fair)
- 2000-4000 ppm: 50 -> 0 (Poor)
- 4000+ ppm: 0 (Critical)
"""

def calculate_aqi(co2):
    """
    Calculate AQI score (0-100) based on CO2 ppm.
    
    Args:
        co2 (int/float): CO2 concentration in ppm
        
    Returns:
        int: AQI score (0-100), or None if input is invalid
    """
    if co2 is None:
        return None
        
    try:
        co2 = float(co2)
    except (ValueError, TypeError):
        return None

    # Cap values
    if co2 <= 800:
        return 100
    if co2 >= 4000:
        return 0
    
    # Piecewise calculation
    if co2 <= 1000:
        # Range 800-1000 maps to 100-90
        # 200 ppm range -> 10 AQI points
        score = 100 - ((co2 - 800) / 200) * 10
    elif co2 <= 2000:
        # Range 1000-2000 maps to 90-50
        # 1000 ppm range -> 40 AQI points
        score = 90 - ((co2 - 1000) / 1000) * 40
    else:
        # Range 2000-4000 maps to 50-0
        # 2000 ppm range -> 50 AQI points
        score = 50 - ((co2 - 2000) / 2000) * 50
        
    return int(round(score))


def get_aqi_status(score):
    """
    Get textual status for AQI score.
    Does NOT replace existing CO2 distribution buckets (Good/Moderate/High/Critical).
    
    Args:
        score (int): AQI score (0-100)
        
    Returns:
        str: Status label (Excellent, Good, Fair, Poor)
    """
    if score is None:
        return None
        
    if score >= 90:
        return 'Excellent'
    if score >= 70:
        return 'Good'
    if score >= 50:
        return 'Fair'
    return 'Poor'
