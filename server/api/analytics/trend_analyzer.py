"""
Trend Analysis Module

Provides statistical analysis functions for time-series data:
- Moving averages (simple and exponential)
- Linear regression trend lines
- Anomaly detection using Z-score method
"""

import numpy as np
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime


@dataclass
class TrendResult:
    """Result of trend analysis."""
    slope: float
    intercept: float
    r_squared: float
    trend_direction: str  # 'increasing', 'decreasing', 'stable'
    predicted_values: List[float]


@dataclass
class AnomalyResult:
    """Result of anomaly detection."""
    anomaly_indices: List[int]
    z_scores: List[float]
    threshold: float
    anomaly_count: int


def calculate_moving_average(
    values: List[float],
    window_size: int = 5,
    method: str = 'simple'
) -> List[float]:
    """
    Calculate moving average of a time series.
    
    Args:
        values: List of numeric values
        window_size: Size of the moving window
        method: 'simple' or 'exponential'
        
    Returns:
        List of moving average values (same length as input, with NaN for initial values)
    """
    if not values or len(values) < window_size:
        return [np.nan] * len(values)
    
    values_array = np.array(values, dtype=float)
    
    if method == 'simple':
        # Simple Moving Average (SMA)
        result = np.full(len(values), np.nan)
        for i in range(window_size - 1, len(values)):
            result[i] = np.mean(values_array[i - window_size + 1:i + 1])
        return result.tolist()
    
    elif method == 'exponential':
        # Exponential Moving Average (EMA)
        alpha = 2 / (window_size + 1)
        result = np.full(len(values), np.nan)
        result[window_size - 1] = np.mean(values_array[:window_size])
        
        for i in range(window_size, len(values)):
            result[i] = alpha * values_array[i] + (1 - alpha) * result[i - 1]
        
        return result.tolist()
    
    else:
        raise ValueError(f"Unknown method: {method}. Use 'simple' or 'exponential'.")


def calculate_linear_regression(
    x_values: List[float],
    y_values: List[float]
) -> TrendResult:
    """
    Calculate linear regression trend line.
    
    Args:
        x_values: Independent variable (e.g., time indices or timestamps)
        y_values: Dependent variable (e.g., CO2, temperature)
        
    Returns:
        TrendResult with slope, intercept, R², trend direction, and predicted values
    """
    if len(x_values) != len(y_values) or len(x_values) < 2:
        raise ValueError("x_values and y_values must have the same length and at least 2 points")
    
    # Remove NaN values
    valid_indices = [i for i in range(len(y_values)) if not np.isnan(y_values[i])]
    x = np.array([x_values[i] for i in valid_indices])
    y = np.array([y_values[i] for i in valid_indices])
    
    if len(x) < 2:
        return TrendResult(
            slope=0.0,
            intercept=np.mean(y) if len(y) > 0 else 0.0,
            r_squared=0.0,
            trend_direction='stable',
            predicted_values=[np.nan] * len(x_values)
        )
    
    # Calculate linear regression using least squares
    n = len(x)
    x_mean = np.mean(x)
    y_mean = np.mean(y)
    
    # Slope (β1) = Σ((x - x̄)(y - ȳ)) / Σ((x - x̄)²)
    numerator = np.sum((x - x_mean) * (y - y_mean))
    denominator = np.sum((x - x_mean) ** 2)
    
    if denominator == 0:
        slope = 0.0
    else:
        slope = numerator / denominator
    
    # Intercept (β0) = ȳ - β1 * x̄
    intercept = y_mean - slope * x_mean
    
    # Predicted values
    y_pred = slope * x + intercept
    
    # R-squared (coefficient of determination)
    ss_total = np.sum((y - y_mean) ** 2)
    ss_residual = np.sum((y - y_pred) ** 2)
    
    if ss_total == 0:
        r_squared = 0.0
    else:
        r_squared = 1 - (ss_residual / ss_total)
    
    # Determine trend direction
    if abs(slope) < 0.01:  # Threshold for "stable"
        trend_direction = 'stable'
    elif slope > 0:
        trend_direction = 'increasing'
    else:
        trend_direction = 'decreasing'
    
    # Create full predicted values array (including NaN positions)
    predicted_full = [np.nan] * len(x_values)
    for i, idx in enumerate(valid_indices):
        predicted_full[idx] = y_pred[i]
    
    return TrendResult(
        slope=round(slope, 4),
        intercept=round(intercept, 2),
        r_squared=round(r_squared, 4),
        trend_direction=trend_direction,
        predicted_values=predicted_full
    )


def detect_anomalies(
    values: List[float],
    threshold: float = 3.0,
    window_size: Optional[int] = None
) -> AnomalyResult:
    """
    Detect anomalies using Z-score method.
    
    Args:
        values: List of numeric values
        threshold: Z-score threshold (default 3.0 = 99.7% confidence)
        window_size: If provided, use rolling window for local anomaly detection
        
    Returns:
        AnomalyResult with anomaly indices, Z-scores, and count
    """
    values_array = np.array(values, dtype=float)
    
    # Remove NaN values for calculation
    valid_mask = ~np.isnan(values_array)
    valid_values = values_array[valid_mask]
    
    if len(valid_values) < 3:
        return AnomalyResult(
            anomaly_indices=[],
            z_scores=[0.0] * len(values),
            threshold=threshold,
            anomaly_count=0
        )
    
    if window_size is None:
        # Global anomaly detection
        mean = np.mean(valid_values)
        std = np.std(valid_values)
        
        if std == 0:
            z_scores = [0.0] * len(values)
        else:
            z_scores = [(v - mean) / std if not np.isnan(v) else 0.0 for v in values_array]
    else:
        # Rolling window anomaly detection
        z_scores = [0.0] * len(values)
        for i in range(len(values)):
            if np.isnan(values_array[i]):
                continue
            
            # Define window
            start = max(0, i - window_size // 2)
            end = min(len(values), i + window_size // 2 + 1)
            window = values_array[start:end]
            window_valid = window[~np.isnan(window)]
            
            if len(window_valid) < 2:
                continue
            
            window_mean = np.mean(window_valid)
            window_std = np.std(window_valid)
            
            if window_std > 0:
                z_scores[i] = (values_array[i] - window_mean) / window_std
    
    # Identify anomalies
    anomaly_indices = [i for i, z in enumerate(z_scores) if abs(z) > threshold]
    
    return AnomalyResult(
        anomaly_indices=anomaly_indices,
        z_scores=z_scores,
        threshold=threshold,
        anomaly_count=len(anomaly_indices)
    )


def calculate_trend_strength(r_squared: float) -> str:
    """
    Classify trend strength based on R² value.
    
    Args:
        r_squared: Coefficient of determination
        
    Returns:
        Strength classification: 'very_weak', 'weak', 'moderate', 'strong', 'very_strong'
    """
    if r_squared < 0.2:
        return 'very_weak'
    elif r_squared < 0.4:
        return 'weak'
    elif r_squared < 0.6:
        return 'moderate'
    elif r_squared < 0.8:
        return 'strong'
    else:
        return 'very_strong'
