"""
Mold Risk Engine

Implements the Growth over Reading Period (GoRP) calculation and
stateful tracking of mold risk with the 24-hour reset rule.

Based on the IPI Dew Point Calculator methodology as described in
docs/mold_risk_calculation.md
"""

from dataclasses import dataclass, asdict
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from .dtm_lookup import get_dtm, is_favorable_for_mold


UTC = timezone.utc


@dataclass
class MoldRiskState:
    """
    State tracker for mold risk calculation.
    
    Attributes:
        current_risk_score: Accumulated mold risk (GoRP sum)
        last_unfavorable_timestamp: Last time conditions were unfavorable for mold
        last_update_ts: Timestamp of last state update
    """
    current_risk_score: float = 0.0
    last_unfavorable_timestamp: Optional[datetime] = None
    last_update_ts: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for MongoDB storage."""
        return {
            'current_risk_score': self.current_risk_score,
            'last_unfavorable_timestamp': self.last_unfavorable_timestamp.isoformat() if self.last_unfavorable_timestamp else None,
            'last_update_ts': self.last_update_ts.isoformat() if self.last_update_ts else None
        }
    
    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]]) -> 'MoldRiskState':
        """Create from dictionary (MongoDB document)."""
        if not data:
            return cls()
        
        last_unfav = data.get('last_unfavorable_timestamp')
        last_update = data.get('last_update_ts')
        
        return cls(
            current_risk_score=data.get('current_risk_score', 0.0),
            last_unfavorable_timestamp=datetime.fromisoformat(last_unfav) if last_unfav else None,
            last_update_ts=datetime.fromisoformat(last_update) if last_update else None
        )


def calculate_mgr(dtm: float) -> float:
    """
    Calculate Mold Growth Rate (MGR).
    
    MGR = 1 / DTM
    
    Args:
        dtm: Days to mold
    
    Returns:
        Mold growth rate (per day)
    """
    if dtm <= 0:
        return 0.0
    return 1.0 / dtm


def calculate_gorp(mgr: float, duration_hours: float) -> float:
    """
    Calculate Growth over Reading Period (GoRP).
    
    GoRP = MGR × duration_days
    
    Args:
        mgr: Mold growth rate (per day)
        duration_hours: Duration in hours
    
    Returns:
        Growth over reading period
    """
    duration_days = duration_hours / 24.0
    return mgr * duration_days


def update_mold_risk_state(
    current_state: MoldRiskState,
    temp_c: float,
    rh: float,
    timestamp: datetime,
    reading_interval_minutes: float = 30.0
) -> tuple[MoldRiskState, float]:
    """
    Update mold risk state based on a new reading.
    
    Implements the core logic:
    1. Check if conditions are favorable for mold
    2. If favorable: calculate GoRP and add to accumulated risk
    3. If unfavorable: track consecutive unfavorable time
    4. Apply 24-hour reset rule
    
    Args:
        current_state: Current mold risk state
        temp_c: Temperature in Celsius
        rh: Relative humidity (0-100%)
        timestamp: Reading timestamp
        reading_interval_minutes: Time between readings (default 30 min)
    
    Returns:
        Tuple of (new_state, current_risk_score)
    """
    # Ensure timestamp is timezone-aware
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=UTC)
    
    # Initialize state if this is the first reading
    if current_state.last_update_ts is None:
        current_state.last_update_ts = timestamp
    
    # Check if conditions are favorable for mold
    favorable = is_favorable_for_mold(temp_c, rh)
    
    if favorable:
        # Get DTM and calculate MGR
        dtm = get_dtm(temp_c, rh)
        
        if dtm is not None:
            mgr = calculate_mgr(dtm)
            
            # Calculate time since last update
            time_delta = timestamp - current_state.last_update_ts
            duration_hours = time_delta.total_seconds() / 3600.0
            
            # Calculate GoRP for this period
            gorp = calculate_gorp(mgr, duration_hours)
            
            # Add to accumulated risk
            new_risk_score = current_state.current_risk_score + gorp
        else:
            # DTM is None (shouldn't happen if favorable=True, but safety check)
            new_risk_score = current_state.current_risk_score
        
        # Reset unfavorable tracking since conditions are now favorable
        new_state = MoldRiskState(
            current_risk_score=new_risk_score,
            last_unfavorable_timestamp=None,
            last_update_ts=timestamp
        )
    
    else:
        # Conditions are unfavorable for mold
        # Track when unfavorable conditions started
        if current_state.last_unfavorable_timestamp is None:
            # First unfavorable reading after favorable period
            last_unfavorable = timestamp
        else:
            # Continue tracking from previous unfavorable timestamp
            last_unfavorable = current_state.last_unfavorable_timestamp
        
        # Check if unfavorable conditions have persisted for 24 hours
        unfavorable_duration = timestamp - last_unfavorable
        
        if unfavorable_duration >= timedelta(hours=24):
            # Reset rule: 24 consecutive hours of unfavorable conditions
            new_risk_score = 0.0
        else:
            # Keep current risk score (pause accumulation)
            new_risk_score = current_state.current_risk_score
        
        new_state = MoldRiskState(
            current_risk_score=new_risk_score,
            last_unfavorable_timestamp=last_unfavorable,
            last_update_ts=timestamp
        )
    
    return new_state, new_state.current_risk_score


def get_risk_level(risk_score: float) -> str:
    """
    Get risk level classification based on score.
    
    Based on the interpretation table from docs/mold_risk_calculation.md:
    - 0: None
    - 0-0.50: Low
    - 0.50-1.00: Medium
    - 1.0: High
    - >1.0: Active
    
    Args:
        risk_score: Accumulated mold risk score
    
    Returns:
        Risk level string
    """
    if risk_score == 0:
        return "none"
    elif risk_score < 0.50:
        return "low"
    elif risk_score < 1.00:
        return "medium"
    elif risk_score == 1.00:
        return "high"
    else:
        return "active"


def get_risk_recommendations(risk_score: float) -> list[str]:
    """
    Get recommendations based on risk level.
    
    Args:
        risk_score: Accumulated mold risk score
    
    Returns:
        List of recommendation strings
    """
    level = get_risk_level(risk_score)
    
    recommendations = {
        "none": [],
        "low": ["Monitor for upward trends."],
        "medium": [
            "Caution: Inspect the area.",
            "Improve airflow and ventilation."
        ],
        "high": [
            "High probability of germination.",
            "Immediate action required.",
            "Increase ventilation significantly."
        ],
        "active": [
            "Critical: Mold is likely active.",
            "Immediate intervention required.",
            "Professional inspection recommended."
        ]
    }
    
    return recommendations.get(level, [])
