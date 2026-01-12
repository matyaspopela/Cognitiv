/**
 * Time window utilities for dashboard and charts
 * Handles time range calculations, bucket size selection, and time formatting
 */

/**
 * Calculate time range for given window
 * @param {string} window - '1h', '24h', '7d', or '30d'
 * @returns {Object} {start: ISOString, end: ISOString}
 */
export const getTimeWindowRange = (window) => {
  const now = new Date()
  let hoursBack = 24 // default 24h
  
  if (window === '1h') {
    hoursBack = 1
  } else if (window === '7d') {
    hoursBack = 7 * 24
  } else if (window === '30d') {
    hoursBack = 30 * 24
  }
  
  const start = new Date(now.getTime() - (hoursBack * 60 * 60 * 1000))
  
  return {
    start: start.toISOString(),
    end: now.toISOString()
  }
}

/**
 * Get bucket size for API calls based on time window
 * 
 * Performance Optimization:
 * - For longer time periods (>24h), data is aggregated into averages on the backend
 * - This reduces data transfer and improves chart rendering performance
 * - CSV exports are NOT affected - they always use raw data regardless of bucket size
 * 
 * Bucketing Strategy:
 * - 1h window: 'raw' - No aggregation, highest granularity (~60-120 data points)
 * - 24h window: '10min' - 10-minute averages (~144 data points)
 * - 7d window: 'hour' - Hourly averages (~168 data points)
 * - 30d window: 'day' - Daily averages (~30 data points)
 * 
 * @param {string} window - '1h', '24h', '7d', or '30d'
 * @returns {string} bucket size ('raw', '10min', 'hour', or 'day')
 */
export const getBucketSize = (window) => {
  if (window === '1h') {
    return 'raw' // Use raw data for 1 hour (most granular)
  } else if (window === '24h') {
    return '10min' // 10-minute aggregation
  } else if (window === '7d') {
    return 'hour' // Hourly aggregation
  } else if (window === '30d') {
    return 'day' // Daily aggregation
  }
  return '10min' // default fallback
}

/**
 * Format timestamp for chart labels based on time window
 * @param {string|Date} timestamp - ISO string or Date object
 * @param {string} window - '1h', '24h', '7d', or '30d'
 * @returns {string} Formatted time string
 */
export const formatTimeLabel = (timestamp, window) => {
  const date = new Date(timestamp)
  
  // Handle invalid dates
  if (isNaN(date.getTime())) {
    return ''
  }
  
  // Use English locale
  if (window === '1h' || window === '24h') {
    // Show hours/minutes for 1h and 24h windows
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    })
  } else if (window === '7d') {
    // Show day and time for 7d window
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    })
  } else {
    // Show date for 30d window
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    })
  }
}

/**
 * Get hours value for stats API calls
 * @param {string} window - '1h', '24h', '7d', or '30d'
 * @returns {number} Hours value
 */
export const getHoursForStats = (window) => {
  if (window === '1h') {
    return 1
  } else if (window === '24h') {
    return 24
  } else if (window === '7d') {
    return 168 // 7 * 24
  } else if (window === '30d') {
    return 720 // 30 * 24
  }
  return 24 // default
}









