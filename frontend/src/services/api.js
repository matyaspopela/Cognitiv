import axios from 'axios'

// Base URL configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

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

// Connect API
export const connectAPI = {
  uploadFirmware: async (boardName, ssid, password) => {
    return apiClient.post('/connect/upload', {
      boardName,
      ssid,
      password,
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

export default apiClient
