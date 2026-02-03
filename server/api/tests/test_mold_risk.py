"""
Tests for Mold Risk Factor calculation system.

Tests DTM lookup, mold risk engine, and the 24-hour reset rule.
"""

import unittest
import sys
import os
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

# Add server to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from django.conf import settings
if not settings.configured:
    settings.configure(DEFAULT_CHARSET='utf-8')


UTC = timezone.utc


class TestDTMLookup(unittest.TestCase):
    """Tests for DTM lookup service."""
    
    def test_dtm_exact_match(self):
        """Test DTM lookup for exact table values."""
        from api.analytics.dtm_lookup import get_dtm
        
        # Test exact match from table
        dtm = get_dtm(temp_c=25, rh=90)
        self.assertEqual(dtm, 4)
        
        dtm = get_dtm(temp_c=20, rh=80)
        self.assertEqual(dtm, 20)
    
    def test_dtm_interpolation(self):
        """Test DTM interpolation between table values."""
        from api.analytics.dtm_lookup import get_dtm
        
        # Test interpolation (should be between known values)
        dtm = get_dtm(temp_c=22.5, rh=87.5)
        self.assertIsNotNone(dtm)
        self.assertGreater(dtm, 0)
        
        # Should be between corner values
        # At 22.5°C, 87.5% RH, we're interpolating between:
        # (20, 85)=12, (20, 90)=7, (25, 85)=7, (25, 90)=4
        # Result should be between 4 and 12
        self.assertGreaterEqual(dtm, 4)
        self.assertLessEqual(dtm, 12)
    
    def test_dtm_unfavorable_conditions(self):
        """Test that unfavorable conditions return None."""
        from api.analytics.dtm_lookup import get_dtm
        
        # RH too low
        dtm = get_dtm(temp_c=20, rh=60)
        self.assertIsNone(dtm)
        
        # Temperature too low
        dtm = get_dtm(temp_c=0, rh=80)
        self.assertIsNone(dtm)
        
        # Temperature too high
        dtm = get_dtm(temp_c=50, rh=80)
        self.assertIsNone(dtm)
    
    def test_is_favorable_for_mold(self):
        """Test favorable condition detection."""
        from api.analytics.dtm_lookup import is_favorable_for_mold
        
        # Favorable
        self.assertTrue(is_favorable_for_mold(temp_c=25, rh=80))
        
        # Unfavorable - low RH
        self.assertFalse(is_favorable_for_mold(temp_c=25, rh=60))
        
        # Unfavorable - low temp
        self.assertFalse(is_favorable_for_mold(temp_c=1, rh=80))
        
        # Unfavorable - high temp
        self.assertFalse(is_favorable_for_mold(temp_c=50, rh=80))


class TestMoldRiskEngine(unittest.TestCase):
    """Tests for mold risk engine."""
    
    def test_mgr_calculation(self):
        """Test MGR calculation."""
        from api.analytics.mold_risk_engine import calculate_mgr
        
        mgr = calculate_mgr(dtm=10)
        self.assertEqual(mgr, 0.1)
        
        mgr = calculate_mgr(dtm=4)
        self.assertEqual(mgr, 0.25)
        
        # Edge case: zero DTM
        mgr = calculate_mgr(dtm=0)
        self.assertEqual(mgr, 0.0)
    
    def test_gorp_calculation(self):
        """Test GoRP calculation."""
        from api.analytics.mold_risk_engine import calculate_gorp
        
        # 24 hours at MGR=0.1 should give 0.1
        gorp = calculate_gorp(mgr=0.1, duration_hours=24)
        self.assertAlmostEqual(gorp, 0.1, places=4)
        
        # 12 hours at MGR=0.25 should give 0.125
        gorp = calculate_gorp(mgr=0.25, duration_hours=12)
        self.assertAlmostEqual(gorp, 0.125, places=4)
    
    def test_risk_accumulation(self):
        """Test that risk accumulates over favorable conditions."""
        from api.analytics.mold_risk_engine import MoldRiskState, update_mold_risk_state
        
        # Start with a state that has a previous timestamp
        ts0 = datetime(2024, 1, 1, 12, 0, tzinfo=UTC)
        state = MoldRiskState(
            current_risk_score=0.0,
            last_unfavorable_timestamp=None,
            last_update_ts=ts0
        )
        
        # First reading: favorable conditions (25°C, 90% RH), 30 minutes later
        ts1 = ts0 + timedelta(minutes=30)
        state, risk1 = update_mold_risk_state(
            current_state=state,
            temp_c=25,
            rh=90,
            timestamp=ts1,
            reading_interval_minutes=30
        )
        
        # Risk should be > 0
        self.assertGreater(risk1, 0)
        
        # Second reading: 30 minutes later, same conditions
        ts2 = ts1 + timedelta(minutes=30)
        state, risk2 = update_mold_risk_state(
            current_state=state,
            temp_c=25,
            rh=90,
            timestamp=ts2,
            reading_interval_minutes=30
        )
        
        # Risk should accumulate
        self.assertGreater(risk2, risk1)
    
    def test_24hour_reset_rule(self):
        """Test that 24 hours of unfavorable conditions resets risk."""
        from api.analytics.mold_risk_engine import MoldRiskState, update_mold_risk_state
        
        # Start with some accumulated risk
        state = MoldRiskState(
            current_risk_score=0.5,
            last_unfavorable_timestamp=None,
            last_update_ts=datetime(2024, 1, 1, 12, 0, tzinfo=UTC)
        )
        
        # First unfavorable reading
        ts1 = datetime(2024, 1, 1, 12, 30, tzinfo=UTC)
        state, risk1 = update_mold_risk_state(
            current_state=state,
            temp_c=20,
            rh=50,  # Below 65% threshold
            timestamp=ts1,
            reading_interval_minutes=30
        )
        
        # Risk should remain the same (paused)
        self.assertEqual(risk1, 0.5)
        
        # 23 hours later, still unfavorable
        ts2 = ts1 + timedelta(hours=23)
        state, risk2 = update_mold_risk_state(
            current_state=state,
            temp_c=20,
            rh=50,
            timestamp=ts2,
            reading_interval_minutes=30
        )
        
        # Risk should still be 0.5 (not reset yet)
        self.assertEqual(risk2, 0.5)
        
        # 24+ hours later, still unfavorable
        ts3 = ts1 + timedelta(hours=24, minutes=30)
        state, risk3 = update_mold_risk_state(
            current_state=state,
            temp_c=20,
            rh=50,
            timestamp=ts3,
            reading_interval_minutes=30
        )
        
        # Risk should be reset to 0
        self.assertEqual(risk3, 0.0)
    
    def test_risk_level_classification(self):
        """Test risk level classification."""
        from api.analytics.mold_risk_engine import get_risk_level
        
        self.assertEqual(get_risk_level(0.0), "none")
        self.assertEqual(get_risk_level(0.3), "low")
        self.assertEqual(get_risk_level(0.7), "medium")
        self.assertEqual(get_risk_level(1.0), "high")
        self.assertEqual(get_risk_level(1.5), "active")
    
    def test_state_serialization(self):
        """Test MoldRiskState to/from dict conversion."""
        from api.analytics.mold_risk_engine import MoldRiskState
        
        original = MoldRiskState(
            current_risk_score=0.75,
            last_unfavorable_timestamp=datetime(2024, 1, 1, 12, 0, tzinfo=UTC),
            last_update_ts=datetime(2024, 1, 1, 13, 0, tzinfo=UTC)
        )
        
        # Convert to dict
        data = original.to_dict()
        
        # Convert back
        restored = MoldRiskState.from_dict(data)
        
        self.assertEqual(restored.current_risk_score, original.current_risk_score)
        self.assertEqual(restored.last_unfavorable_timestamp, original.last_unfavorable_timestamp)
        self.assertEqual(restored.last_update_ts, original.last_update_ts)
    
    def test_unfavorable_pause_not_reset(self):
        """Test that unfavorable conditions pause but don't immediately reset."""
        from api.analytics.mold_risk_engine import MoldRiskState, update_mold_risk_state
        
        # Start with accumulated risk
        state = MoldRiskState(
            current_risk_score=0.8,
            last_unfavorable_timestamp=None,
            last_update_ts=datetime(2024, 1, 1, 12, 0, tzinfo=UTC)
        )
        
        # Unfavorable reading (only 1 hour)
        ts = datetime(2024, 1, 1, 13, 0, tzinfo=UTC)
        state, risk = update_mold_risk_state(
            current_state=state,
            temp_c=20,
            rh=50,
            timestamp=ts,
            reading_interval_minutes=30
        )
        
        # Risk should be paused at 0.8, not reset
        self.assertEqual(risk, 0.8)


if __name__ == '__main__':
    unittest.main()
