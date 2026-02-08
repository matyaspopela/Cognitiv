import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, BarChart2, BookOpen } from 'lucide-react'
import { adminAPI } from '../services/api'
import Button from '../components/ui/Button'
import AdminDeviceHeader from '../components/admin/AdminDeviceHeader'
import AdminDeviceStats from '../components/admin/AdminDeviceStats'
import AdminAnnotatedView from '../components/admin/AdminAnnotatedView'
import DeviceRenameModal from '../components/admin/DeviceRenameModal'
import DeviceCustomizationModal from '../components/admin/DeviceCustomizationModal'
import './AdminDevicePage.css'

const AdminDevicePage = () => {
    const { deviceId } = useParams()
    const navigate = useNavigate()
    const location = useLocation()

    const [device, setDevice] = useState(location.state?.device || null)
    const [loading, setLoading] = useState(!location.state?.device)
    const [error, setError] = useState('')
    const [activeTab, setActiveTab] = useState('time_series')

    // Modal states
    const [showRenameModal, setShowRenameModal] = useState(false)
    const [showCustomizeModal, setShowCustomizeModal] = useState(false)

    // Fetch device if not passed via navigation state
    useEffect(() => {
        const fetchDevice = async () => {
            if (device) return // Already have device from navigation

            try {
                setLoading(true)
                setError('')
                const response = await adminAPI.getDevices()

                if (response.data.status === 'success') {
                    const devices = response.data.devices || []
                    const foundDevice = devices.find(
                        d => d.mac_address === deviceId || d.device_id === deviceId
                    )

                    if (foundDevice) {
                        setDevice(foundDevice)
                    } else {
                        setError('Device not found')
                    }
                } else {
                    setError('Failed to load device')
                }
            } catch (err) {
                console.error('Error fetching device:', err)
                setError('Failed to load device')
            } finally {
                setLoading(false)
            }
        }

        fetchDevice()
    }, [deviceId, device])

    const handleRenameSuccess = () => {
        // Refresh device data
        setDevice(null)
        setShowRenameModal(false)
    }

    const handleCustomizeSuccess = () => {
        // Refresh device data
        setDevice(null)
        setShowCustomizeModal(false)
    }

    if (loading) {
        return (
            <div className="flex-1 flex flex-col w-full">
                <div className="flex flex-col gap-6">
                    <div className="bg-zinc-900/50 border border-white/10 rounded-lg p-12 text-center">
                        <p className="text-zinc-400">Loading device...</p>
                    </div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex-1 flex flex-col w-full">
                <div className="flex flex-col gap-6">
                    <Button
                        variant="ghost"
                        size="medium"
                        onClick={() => navigate('/admin')}
                        className="flex items-center gap-2 self-start"
                    >
                        <ArrowLeft size={18} />
                        Back to Device List
                    </Button>
                    <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-6">
                        <p className="text-red-400">{error}</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col w-full">
            <div className="flex flex-col gap-6">
                {/* Back Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate('/admin')}
                    className="self-start text-zinc-500 hover:text-zinc-100 transition-colors"
                >
                    <ArrowLeft size={20} />
                </Button>

                {/* Device Header */}
                <AdminDeviceHeader
                    device={device}
                    onSettingsClick={() => setShowCustomizeModal(true)}
                />

                {/* Tab Navigation */}
                <div className="flex items-center gap-2 border-b border-white/10 mb-2">
                    <button
                        className={`p-3 text-zinc-400 hover:text-zinc-100 transition-colors border-b-2 ${activeTab === 'time_series' ? 'border-zinc-100 text-zinc-100' : 'border-transparent'}`}
                        onClick={() => setActiveTab('time_series')}
                        title="Time Series"
                    >
                        <BarChart2 size={20} />
                    </button>
                    <button
                        className={`p-3 text-zinc-400 hover:text-zinc-100 transition-colors border-b-2 ${activeTab === 'annotated' ? 'border-zinc-100 text-zinc-100' : 'border-transparent'}`}
                        onClick={() => setActiveTab('annotated')}
                        title="Annotated Data"
                    >
                        <BookOpen size={20} />
                    </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'time_series' && <AdminDeviceStats deviceId={deviceId} />}
                {activeTab === 'annotated' && <AdminAnnotatedView deviceId={deviceId} />}

                {/* Modals */}
                {showRenameModal && device && (
                    <DeviceRenameModal
                        device={device}
                        onClose={() => setShowRenameModal(false)}
                        onRenameSuccess={handleRenameSuccess}
                    />
                )}

                {showCustomizeModal && device && (
                    <DeviceCustomizationModal
                        device={device}
                        onClose={() => setShowCustomizeModal(false)}
                        onCustomizeSuccess={handleCustomizeSuccess}
                    />
                )}
            </div>
        </div>
    )
}

export default AdminDevicePage
