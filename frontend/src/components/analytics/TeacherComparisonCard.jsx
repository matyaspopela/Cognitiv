import { useState, useEffect } from 'react'
import { annotatedAPI } from '../../services/api'
import { getCo2Style, getCo2Color } from '../../utils/colors'
import Card from '../ui/Card'
import ProgressBar from '../ui/ProgressBar'

/**
 * TeacherComparisonCard - Shows air quality comparison by teacher
 */
const TeacherComparisonCard = ({ deviceId, startDate, endDate }) => {
    const [teachers, setTeachers] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true)
                setError(null)

                const response = await annotatedAPI.getLessons(startDate, endDate, deviceId)

                if (response?.data?.status === 'success' && response.data.by_teacher) {
                    setTeachers(response.data.by_teacher.slice(0, 8))
                } else {
                    setError('Failed to load teacher data')
                }
            } catch (err) {
                console.error('Error loading teacher comparison:', err)
                setError('Error loading data')
            } finally {
                setLoading(false)
            }
        }

        loadData()
    }, [deviceId, startDate, endDate])



    return (
        <Card className="teacher-comparison-card">
            <h3 className="text-lg font-semibold text-zinc-100 mb-4">
                Air Quality by Teacher
            </h3>
            <div style={{ minHeight: '200px' }}>
                {loading ? (
                    <div className="flex items-center justify-center h-full py-8">
                        <ProgressBar indeterminate />
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center h-full text-zinc-500 py-8">
                        <p>{error}</p>
                    </div>
                ) : teachers.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-zinc-500 py-8">
                        <p>No teacher data available</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {teachers.map((teacher, index) => (
                            <div
                                key={teacher.teacher || index}
                                className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800/50"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-zinc-200 truncate">
                                        {teacher.teacher || 'Unknown'}
                                    </p>
                                    <p className="text-xs text-zinc-500">
                                        {teacher.lesson_count} lessons
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-semibold" style={{ color: getCo2Style(teacher.avg_co2).textColor }}>
                                        {teacher.avg_co2} ppm
                                    </p>
                                    <div className="flex items-center gap-1 mt-1">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getCo2Color(teacher.avg_co2) }} />
                                        <span className="text-xs text-zinc-500">
                                            avg: {Math.round(teacher.avg_co2)} · max: {teacher.max_co2}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Card>
    )
}

export default TeacherComparisonCard
