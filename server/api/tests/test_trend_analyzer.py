"""
Tests for trend analysis module.

Verifies:
1. Moving average calculations (SMA and EMA)
2. Linear regression trend detection
3. Anomaly detection using Z-scores
"""

import unittest
import sys
import os

# Add server to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from api.analytics.trend_analyzer import (
    calculate_moving_average,
    calculate_linear_regression,
    detect_anomalies,
    calculate_trend_strength
)


class TestMovingAverage(unittest.TestCase):
    """Tests for moving average calculations."""
    
    def test_simple_moving_average(self):
        """Test SMA calculation."""
        values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        result = calculate_moving_average(values, window_size=3, method='simple')
        
        # First two values should be NaN
        self.assertTrue(all(str(x) == 'nan' for x in result[:2]))
        
        # Third value should be average of first 3: (1+2+3)/3 = 2.0
        self.assertAlmostEqual(result[2], 2.0, places=2)
        
        # Fourth value: (2+3+4)/3 = 3.0
        self.assertAlmostEqual(result[3], 3.0, places=2)
    
    def test_exponential_moving_average(self):
        """Test EMA calculation."""
        values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        result = calculate_moving_average(values, window_size=3, method='exponential')
        
        # First two values should be NaN
        self.assertTrue(all(str(x) == 'nan' for x in result[:2]))
        
        # EMA should be calculated for remaining values
        self.assertIsNotNone(result[2])
        self.assertFalse(str(result[2]) == 'nan')
    
    def test_moving_average_insufficient_data(self):
        """Test that insufficient data returns NaN."""
        values = [1, 2]
        result = calculate_moving_average(values, window_size=5, method='simple')
        
        self.assertEqual(len(result), 2)
        self.assertTrue(all(str(x) == 'nan' for x in result))


class TestLinearRegression(unittest.TestCase):
    """Tests for linear regression trend analysis."""
    
    def test_increasing_trend(self):
        """Test detection of increasing trend."""
        x = [1, 2, 3, 4, 5]
        y = [2, 4, 6, 8, 10]  # Perfect linear increase
        
        result = calculate_linear_regression(x, y)
        
        self.assertGreater(result.slope, 0)
        self.assertEqual(result.trend_direction, 'increasing')
        self.assertGreater(result.r_squared, 0.99)  # Nearly perfect fit
    
    def test_decreasing_trend(self):
        """Test detection of decreasing trend."""
        x = [1, 2, 3, 4, 5]
        y = [10, 8, 6, 4, 2]  # Perfect linear decrease
        
        result = calculate_linear_regression(x, y)
        
        self.assertLess(result.slope, 0)
        self.assertEqual(result.trend_direction, 'decreasing')
        self.assertGreater(result.r_squared, 0.99)
    
    def test_stable_trend(self):
        """Test detection of stable (flat) trend."""
        x = [1, 2, 3, 4, 5]
        y = [5, 5, 5, 5, 5]  # Constant values
        
        result = calculate_linear_regression(x, y)
        
        self.assertAlmostEqual(result.slope, 0.0, places=2)
        self.assertEqual(result.trend_direction, 'stable')
    
    def test_regression_with_noise(self):
        """Test regression with noisy data."""
        x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        y = [2.1, 3.9, 6.2, 7.8, 10.1, 11.9, 14.2, 15.8, 18.1, 19.9]  # Noisy linear
        
        result = calculate_linear_regression(x, y)
        
        self.assertGreater(result.slope, 0)
        self.assertEqual(result.trend_direction, 'increasing')
        self.assertGreater(result.r_squared, 0.9)  # Strong correlation despite noise


class TestAnomalyDetection(unittest.TestCase):
    """Tests for anomaly detection."""
    
    def test_no_anomalies_in_normal_data(self):
        """Test that normal data has no anomalies."""
        values = [10, 11, 10, 12, 11, 10, 11, 12, 10, 11]
        
        result = detect_anomalies(values, threshold=3.0)
        
        self.assertEqual(result.anomaly_count, 0)
        self.assertEqual(len(result.anomaly_indices), 0)
    
    def test_detects_outliers(self):
        """Test that outliers are detected."""
        values = [10, 11, 10, 12, 100, 11, 10, 11, 12, 10]  # 100 is an outlier
        
        result = detect_anomalies(values, threshold=2.0)
        
        self.assertGreater(result.anomaly_count, 0)
        self.assertIn(4, result.anomaly_indices)  # Index 4 has the outlier
    
    def test_threshold_sensitivity(self):
        """Test that lower threshold detects more anomalies."""
        values = [10, 11, 10, 12, 15, 11, 10, 11, 12, 10]
        
        result_strict = detect_anomalies(values, threshold=3.0)
        result_lenient = detect_anomalies(values, threshold=1.5)
        
        # Lenient threshold should detect more anomalies
        self.assertGreaterEqual(result_lenient.anomaly_count, result_strict.anomaly_count)
    
    def test_rolling_window_anomaly_detection(self):
        """Test rolling window anomaly detection."""
        # Create data with local anomaly
        values = [10, 11, 10, 12, 11, 50, 11, 10, 12, 11]
        
        result = detect_anomalies(values, threshold=2.0, window_size=5)
        
        self.assertGreater(result.anomaly_count, 0)


class TestTrendStrength(unittest.TestCase):
    """Tests for trend strength classification."""
    
    def test_very_weak_trend(self):
        """Test classification of very weak trend."""
        self.assertEqual(calculate_trend_strength(0.1), 'very_weak')
    
    def test_weak_trend(self):
        """Test classification of weak trend."""
        self.assertEqual(calculate_trend_strength(0.3), 'weak')
    
    def test_moderate_trend(self):
        """Test classification of moderate trend."""
        self.assertEqual(calculate_trend_strength(0.5), 'moderate')
    
    def test_strong_trend(self):
        """Test classification of strong trend."""
        self.assertEqual(calculate_trend_strength(0.7), 'strong')
    
    def test_very_strong_trend(self):
        """Test classification of very strong trend."""
        self.assertEqual(calculate_trend_strength(0.95), 'very_strong')


if __name__ == '__main__':
    unittest.main()
