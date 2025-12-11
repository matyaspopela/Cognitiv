/**
 * Time window utilities for dashboard and charts
 * Handles time range calculations, bucket size selection, and time formatting
 */

/**
 * Calculate time range for given window
 * @param {string} window - '24h', '7d', or '30d'
 * @returns {Object} {start: ISOString, end: ISOString}
 */
export const getTimeWindowRange = (window) => {
  const now = new Date()
  let hoursBack = 24 // default 24h
  
  if (window === '7d') {
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
 * @param {string} window - '24h', '7d', or '30d'
 * @returns {string} bucket size ('10min', 'hour', or 'day')
 */
export const getBucketSize = (window) => {
  if (window === '24h') {
    return '10min'
  } else if (window === '7d') {
    return 'hour'
  } else if (window === '30d') {
    return 'day'
  }
  return '10min' // default fallback
}

/**
 * Format timestamp for chart labels based on time window
 * @param {string|Date} timestamp - ISO string or Date object
 * @param {string} window - '24h', '7d', or '30d'
 * @returns {string} Formatted time string
 */
export const formatTimeLabel = (timestamp, window) => {
  const date = new Date(timestamp)
  
  // Handle invalid dates
  if (isNaN(date.getTime())) {
    return ''
  }
  
  // Use Czech locale to match backend timezone (Europe/Prague)
  if (window === '24h') {
    // Show hours/minutes for 24h window
    return date.toLocaleTimeString('cs-CZ', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    })
  } else if (window === '7d') {
    // Show day and time for 7d window
    return date.toLocaleDateString('cs-CZ', { 
      weekday: 'short', 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    })
  } else {
    // Show date for 30d window
    return date.toLocaleDateString('cs-CZ', { 
      month: 'short', 
      day: 'numeric'
    })
  }
}

/**
 * Get hours value for stats API calls
 * @param {string} window - '24h', '7d', or '30d'
 * @returns {number} Hours value
 */
export const getHoursForStats = (window) => {
  if (window === '24h') {
    return 24
  } else if (window === '7d') {
    return 168 // 7 * 24
  } else if (window === '30d') {
    return 720 // 30 * 24
  }
  return 24 // default
}

