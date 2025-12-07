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
}

// History API
export const historyAPI = {
  getSeries: async (start = null, end = null, bucket = 'day', deviceId = null) => {
    const params = new URLSearchParams()
    if (start) params.append('start', start)
    if (end) params.append('end', end)
    params.append('bucket', bucket)
    if (deviceId) params.append('device_id', deviceId)
    return apiClient.get(`/history/series?${params.toString()}`)
  },

  getSummary: async (start = null, end = null, deviceId = null) => {
    const params = new URLSearchParams()
    if (start) params.append('start', start)
    if (end) params.append('end', end)
    if (deviceId) params.append('device_id', deviceId)
    return apiClient.get(`/history/summary?${params.toString()}`)
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
  uploadFirmware: async (
    boardName, 
    ssid, 
    password, 
    enableBundling = null, 
    enableDeepSleep = null, 
    deepSleepDurationSeconds = null,
    enableScheduledShutdown = null,
    shutdownHour = null,
    shutdownMinute = null,
    wakeHour = null,
    wakeMinute = null
  ) => {
    return apiClient.post('/connect/upload', {
      boardName,
      ssid,
      password,
      enableBundling,
      enableDeepSleep,
      deepSleepDurationSeconds,
      enableScheduledShutdown,
      shutdownHour,
      shutdownMinute,
      wakeHour,
      wakeMinute,
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
