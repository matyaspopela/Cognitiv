import { useState, useEffect } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { adminAPI } from '../services/api'
import AdminDeviceHeader from '../components/admin/AdminDeviceHeader'
import AdminDeviceStats from '../components/admin/AdminDeviceStats'
import AdminAnnotatedView from '../components/admin/AdminAnnotatedView'
import DeviceRenameModal from '../components/admin/DeviceRenameModal'
import DeviceCustomizationModal from '../components/admin/DeviceCustomizationModal'
import PageHeader from '../components/layout/PageHeader'

const AdminDevicePage = () => {
    const { deviceId } = useParams()
    const location = useLocation()

    const [device, setDevice] = useState(location.state?.device || null)
    const [loading, setLoading] = useState(!location.state?.device)
    const [error, setError] = useState('')

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
                    <div className="bg-stone-50 border border-stone-200 rounded-lg p-12 text-center">
                        <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">
                          Synchronizing Device Stats...
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex-1 flex flex-col w-full">
                <div className="flex flex-col gap-6">
                    <PageHeader showBack={true} />
                    <div className="bg-red-50 border border-red-100 rounded-lg p-6">
                        <p className="text-red-700 text-sm font-medium">{error}</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col w-full">
            <div className="flex flex-col gap-6">
                <PageHeader showBack={true} />

                {/* Device Header */}
                <AdminDeviceHeader
                    device={device}
                    onSettingsClick={() => setShowCustomizeModal(true)}
                />

                {/* Data Section */}
                <AdminDeviceStats deviceId={deviceId} />

                {/* Lessons Section */}
                <div className="flex flex-col gap-6 pt-2">
                    <div className="flex items-center gap-4">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-stone-400">Lessons</span>
                        <div className="flex-1 h-px bg-stone-200" />
                    </div>
                    <AdminAnnotatedView deviceId={deviceId} />
                </div>

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
