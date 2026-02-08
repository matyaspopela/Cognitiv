import { useState, useEffect } from 'react'
import { annotatedAPI } from '../services/api'

/**
 * Get date range for lesson-based time windows
 */
const getLessonDateRange = (mode) => {
    const end = new Date()
    const start = new Date()

    if (mode instanceof Date || (typeof mode === 'string' && !['current_week', 'last_week', 'last_month'].includes(mode))) {
        let date
        if (typeof mode === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(mode)) {
            // Parse YYYY-MM-DD as local time
            const [y, m, d] = mode.split('-').map(Number)
            date = new Date(y, m - 1, d)
        } else {
            date = mode instanceof Date ? mode : new Date(mode)
        }

        if (!isNaN(date.getTime())) {
            // Set start/end relative to the created date object
            // If date was created with new Date(y, m-1, d), it's already 00:00 local time
            start.setTime(date.getTime())
            start.setHours(0, 0, 0, 0) // Enforce start of day

            end.setTime(date.getTime())
            end.setHours(23, 59, 59, 999) // Enforce end of day

            return {
                start: start.toISOString(),
                end: end.toISOString()
            }
        }
    }

    if (mode === 'current_week') {
        const day = start.getDay()
        const diff = start.getDate() - day + (day === 0 ? -6 : 1)
        start.setDate(diff)
        start.setHours(0, 0, 0, 0)
    } else if (mode === 'last_week') {
        const day = end.getDay()
        const diff = end.getDate() - day + (day === 0 ? -6 : 1) - 7
        start.setDate(diff)
        start.setHours(0, 0, 0, 0)
        end.setDate(diff + 6)
        end.setHours(23, 59, 59, 999)
    } else if (mode === 'last_month') {
        start.setDate(end.getDate() - 30)
    }

    return {
        start: start.toISOString(),
        end: end.toISOString()
    }
}

/**
 * Custom hook to fetch annotated lesson data
 * @param {string} deviceId - Device MAC address or ID
 * @param {string} preset - Time range preset ('current_week', 'last_week', 'last_month')
 * @returns {Object} { summary, lessons, heatmap, loading, error }
 */
const useAnnotatedData = (deviceId, preset = 'current_week') => {
    const [summary, setSummary] = useState(null)
    const [lessons, setLessons] = useState([])
    const [heatmap, setHeatmap] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        const fetchData = async () => {
            if (!deviceId) {
                setLoading(false)
                return
            }

            setLoading(true)
            setError('')
            setSummary(null)
            setLessons([])
            setHeatmap(null)

            try {
                const { start, end } = getLessonDateRange(preset)

                // Fetch all data in parallel
                const [summaryResponse, lessonsResponse, heatmapResponse] = await Promise.all([
                    annotatedAPI.getSummary(start, end, deviceId),
                    annotatedAPI.getLessons(start, end, deviceId),
                    annotatedAPI.getHeatmap(deviceId, start, end, 'hourly')
                ])

                // Process summary - Store status, summary stats, AND by_subject breakdown
                if (summaryResponse?.data?.status === 'success') {
                    setSummary(summaryResponse.data)
                }

                // Process lessons - API returns by_teacher and by_period, not lessons array
                if (lessonsResponse?.data?.status === 'success') {
                    setLessons(lessonsResponse.data)
                }

                // Process heatmap
                if (heatmapResponse?.data?.status === 'success') {
                    setHeatmap(heatmapResponse.data.heatmap)
                }

                // Set error if all failed
                if (
                    summaryResponse?.data?.status === 'error' &&
                    lessonsResponse?.data?.status === 'error' &&
                    heatmapResponse?.data?.status === 'error'
                ) {
                    setError('Failed to load annotated data')
                }
            } catch (err) {
                console.error('Error fetching annotated data:', err)
                setError(err.message || 'Failed to load annotated data')
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [deviceId, preset])

    return { summary, lessons, heatmap, loading, error }
}

export default useAnnotatedData
