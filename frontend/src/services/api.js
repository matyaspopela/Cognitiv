import axios from 'axios'

// Base URL configuration
// In development mode (npm run dev), always use relative path to leverage Vite proxy
// This ensures local dev always connects to localhost:8000, not production server
const getApiBaseUrl = () => {
  // In development mode, ignore VITE_API_BASE_URL if it points to production
  // Always use relative path to use Vite proxy configured in vite.config.js
  if (import.meta.env.DEV) {
    const envUrl = import.meta.env.VITE_API_BASE_URL
    if (envUrl && (envUrl.includes('onrender.com') || envUrl.includes('://') && !envUrl.includes('localhost'))) {
      console.warn(
        `⚠️  VITE_API_BASE_URL is set to production URL (${envUrl}) but we're in development mode. ` +
        `Ignoring it and using localhost proxy instead to prevent data duplication.`
      )
      return '/api'
    }
    return '/api'  // Use Vite proxy to localhost:8000
  }
  // In production build, use VITE_API_BASE_URL if set, otherwise default to '/api'
  return import.meta.env.VITE_API_BASE_URL || '/api'
}

const API_BASE_URL = getApiBaseUrl()

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,  // Include cookies for session-based auth
})

// Request interceptor to add auth token if available
apiClient.interceptors.request.use((config) => {
  const authData = localStorage.getItem('cognitiv_admin_auth')
  if (authData) {
    try {
      const auth = JSON.parse(authData)
      if (auth.username) {
        // You can add token-based auth here if needed
        config.headers['X-Admin-User'] = auth.username
      }
    } catch (error) {
      console.error('Error parsing auth data:', error)
    }
  }
  return config
})

// Response interceptor to suppress error logging for history API failures
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Suppress console errors for history API endpoints that commonly fail
    // Components will handle these errors gracefully
    if (error.config?.url?.includes('/history/')) {
      // Return error as rejected promise but don't log
      return Promise.reject(error)
    }
    // For other endpoints, log normally
    return Promise.reject(error)
  }
)

// Data API
export const dataAPI = {
  getData: async (hours = 24, limit = 1000, deviceId = null) => {
    const params = new URLSearchParams()
    params.append('hours', hours.toString())
    params.append('limit', limit.toString())
    if (deviceId) {
      params.append('device_id', deviceId)
    }
    return apiClient.get(`/data?${params.toString()}`)
  },

  getStats: async (hours = 24, deviceId = null) => {
    const params = new URLSearchParams()
    params.append('hours', hours.toString())
    if (deviceId) {
      params.append('device_id', deviceId)
    }
    return apiClient.get(`/stats?${params.toString()}`)
  },

  getStatus: async () => {
    return apiClient.get('/status')
  },

  getDevices: async () => {
    return apiClient.get('/devices')
  },
}

// History API
export const historyAPI = {
  getSeries: async (start = null, end = null, bucket = 'day', deviceId = null) => {
    const params = new URLSearchParams()
    if (start) params.append('start', start)
    if (end) params.append('end', end)
    params.append('bucket', bucket)
    if (deviceId) params.append('device_id', deviceId)
    try {
      return await apiClient.get(`/history/series?${params.toString()}`)
    } catch (error) {
      // Return error response instead of throwing to allow graceful handling
      return Promise.resolve({
        data: { status: 'error', error: error.message },
        response: { status: error.response?.status || 500 },
        status: error.response?.status || 500
      })
    }
  },

  getSummary: async (start = null, end = null, deviceId = null) => {
    const params = new URLSearchParams()
    if (start) params.append('start', start)
    if (end) params.append('end', end)
    if (deviceId) params.append('device_id', deviceId)
    try {
      return await apiClient.get(`/history/summary?${params.toString()}`)
    } catch (error) {
      // Return error response instead of throwing to allow graceful handling
      return Promise.resolve({
        data: { status: 'error', error: error.message },
        response: { status: error.response?.status || 500 },
        status: error.response?.status || 500
      })
    }
  },

  exportCSV: async (start = null, end = null, deviceId = null) => {
    const params = new URLSearchParams()
    if (start) params.append('start', start)
    if (end) params.append('end', end)
    if (deviceId) params.append('device_id', deviceId)
    return apiClient.get(`/history/export?${params.toString()}`, {
      responseType: 'blob',
    })
  },
}

// Admin API
export const adminAPI = {
  login: async (username, password) => {
    return apiClient.post('/admin/login', {
      username,
      password,
    })
  },

  getDevices: async () => {
    return apiClient.get('/admin/devices')
  },

  getDeviceStats: async (deviceId) => {
    return apiClient.get(`/admin/devices/${deviceId}/stats`)
  },

  renameDevice: async (macAddress, displayName) => {
    return apiClient.post(`/admin/devices/${macAddress}/rename`, {
      display_name: displayName
    })
  },

  customizeDevice: async (macAddress, customization) => {
    return apiClient.post(`/admin/devices/${macAddress}/customize`, customization)
  },
}

// AI Assistant API
export const aiAPI = {
  chat: async (message, deviceId = null) => {
    return apiClient.post('/ai/chat', {
      message,
      device_id: deviceId,
    })
  },
}

// Annotated Data API (Admin Panel Analytics)
export const annotatedAPI = {
  /**
   * Get time-bucketed annotated readings for charts
   * @param {string} start - ISO datetime
   * @param {string} end - ISO datetime
   * @param {string} deviceId - Device MAC/name filter (optional)
   * @param {string} bucket - 'hour', 'day', or 'week' (default: 'hour')
   */
  getSeries: async (start, end, deviceId = null, bucket = 'hour') => {
    const params = new URLSearchParams()
    if (start) params.append('start', start)
    if (end) params.append('end', end)
    if (deviceId) params.append('device_id', deviceId)
    params.append('bucket', bucket)
    try {
      return await apiClient.get(`/annotated/series?${params.toString()}`)
    } catch (error) {
      return { data: { status: 'error', error: error.message } }
    }
  },

  /**
   * Get statistical summary including subject breakdown
   * @param {string} start - ISO datetime (optional)
   * @param {string} end - ISO datetime (optional)
   * @param {string} deviceId - Device filter (optional)
   */
  getSummary: async (start = null, end = null, deviceId = null) => {
    const params = new URLSearchParams()
    if (start) params.append('start', start)
    if (end) params.append('end', end)
    if (deviceId) params.append('device_id', deviceId)
    try {
      return await apiClient.get(`/annotated/summary?${params.toString()}`)
    } catch (error) {
      return { data: { status: 'error', error: error.message } }
    }
  },

  /**
   * Get lesson-based analysis (by teacher, by period)
   * @param {string} start - ISO datetime (optional)
   * @param {string} end - ISO datetime (optional)
   * @param {string} deviceId - Device filter (optional)
   */
  getLessons: async (start = null, end = null, deviceId = null) => {
    const params = new URLSearchParams()
    if (start) params.append('start', start)
    if (end) params.append('end', end)
    if (deviceId) params.append('device_id', deviceId)
    try {
      return await apiClient.get(`/annotated/lessons?${params.toString()}`)
    } catch (error) {
      return { data: { status: 'error', error: error.message } }
    }
  },

  /**
   * Get heatmap data
   * @param {string} deviceId - Device filter
   * @param {string} start - ISO datetime (optional)
   * @param {string} end - ISO datetime (optional)
   * @param {string} mode - 'hourly' or 'daily'
   */
  getHeatmap: async (deviceId, start = null, end = null, mode = 'hourly') => {
    const params = new URLSearchParams()
    if (deviceId) params.append('device_id', deviceId)
    if (start) params.append('start', start)
    if (end) params.append('end', end)
    params.append('mode', mode)
    try {
      return await apiClient.get(`/annotated/heatmap?${params.toString()}`)
    } catch (error) {
      return { data: { status: 'error', error: error.message } }
    }
  },
}

export default apiClient

