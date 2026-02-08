import { useState, useEffect } from 'react'
import { historyAPI } from '../services/api'
import { getTimeWindowRange, getBucketSize } from '../utils/timeWindow'

/**
 * Custom hook to fetch device historical data
 * @param {string} deviceId - Device MAC address or ID
 * @param {string} preset - Time range preset ('24h', '7d', '30d', 'custom')
 * @param {Date} customStart - Custom start date (for 'custom' preset)
 * @param {Date} customEnd - Custom end date (for 'custom' preset)
 * @returns {Object} { series, summary, loading, error }
 */
const useDeviceHistory = (deviceId, preset = '24h', customStart = null, customEnd = null) => {
    const [series, setSeries] = useState([])
    const [summary, setSummary] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        const fetchData = async () => {
            if (!deviceId) {
                setLoading(false)
                return
            }

            // Skip if custom mode but dates not set
            if (preset === 'custom' && (!customStart || !customEnd)) {
                setLoading(false)
                return
            }

            setLoading(true)
            setError('')
            setSeries([])
            setSummary(null)

            try {
                let startIso, endIso, bucket

                if (preset === 'custom') {
                    startIso = customStart.toISOString()
                    endIso = customEnd.toISOString()

                    // Determine bucket based on range
                    const diffDays = Math.abs(customEnd - customStart) / (1000 * 60 * 60 * 24)
                    bucket = diffDays <= 1 ? 'raw' : diffDays <= 7 ? 'hour' : 'day'
                } else {
                    const range = getTimeWindowRange(preset)
                    startIso = range.start
                    endIso = range.end
                    bucket = getBucketSize(preset)
                }

                // Fetch summary and series in parallel
                const [summaryResponse, seriesResponse] = await Promise.all([
                    historyAPI.getSummary(startIso, endIso, deviceId),
                    historyAPI.getSeries(startIso, endIso, bucket, deviceId)
                ])

                // Process summary
                if (summaryResponse?.status < 400) {
                    const data = summaryResponse?.data || summaryResponse
                    if (data?.status === 'success' || (data && !data.status)) {
                        setSummary(data.summary || data)
                    }
                }

                // Process series
                if (seriesResponse?.status < 400) {
                    const data = seriesResponse?.data || seriesResponse
                    if (data?.status === 'success' && data.series && Array.isArray(data.series)) {
                        // Filter to ensure data is within range
                        const filtered = data.series.filter(item => {
                            if (!item.bucket_start) return false
                            const pointTime = new Date(item.bucket_start).getTime()
                            const startTime = new Date(startIso).getTime()
                            const endTime = new Date(endIso).getTime()
                            return pointTime >= startTime && pointTime <= endTime
                        })
                        setSeries(filtered)
                    }
                }

                // Set error if both failed
                if (summaryResponse?.status >= 400 && seriesResponse?.status >= 400) {
                    setError('Failed to load historical data')
                }
            } catch (err) {
                console.error('Error fetching device history:', err)
                setError(err.message || 'Failed to load historical data')
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [deviceId, preset, customStart, customEnd])

    return { series, summary, loading, error }
}

export default useDeviceHistory
