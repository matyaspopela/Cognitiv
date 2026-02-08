import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { adminAPI } from '../services/api'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import DataTable from '../components/ui/DataTable'
import DeviceActionsMenu from '../components/admin/DeviceActionsMenu'
import AdminStatusBar from '../components/admin/AdminStatusBar'
import DeviceRenameModal from '../components/admin/DeviceRenameModal'
import DeviceCustomizationModal from '../components/admin/DeviceCustomizationModal'
import DeviceDetailsModal from '../components/admin/DeviceDetailsModal'

const AdminPanel = () => {
  const navigate = useNavigate()
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [detailsDevice, setDetailsDevice] = useState(null)
  const [renameDevice, setRenameDevice] = useState(null)
  const [customizeDevice, setCustomizeDevice] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadDevices()
  }, [])

  const loadDevices = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await adminAPI.getDevices()
      if (response.data.status === 'success') {
        const devicesList = response.data.devices || []

        const isDeviceOnline = (device) => {
          if (!device) return false
          if (device.status === 'offline') return false

          if (device.last_seen) {
            try {
              const lastSeenDate = new Date(device.last_seen)
              if (!isNaN(lastSeenDate.getTime())) {
                const now = new Date()
                const minutesAgo = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60)
                if (minutesAgo > 5) {
                  return false
                }
              }
            } catch (error) {
              // Fallback to status
            }
          }

          return device.status === 'online'
        }

        const devicesWithStatus = devicesList.map(device => ({
          ...device,
          status: isDeviceOnline(device) ? 'online' : 'offline'
        }))

        const sortedDevices = [...devicesWithStatus].sort((a, b) => {
          const aOnline = a.status === 'online' ? 1 : 0
          const bOnline = b.status === 'online' ? 1 : 0
          return bOnline - aOnline
        })
        setDevices(sortedDevices)
      } else {
        setError(response.data.message || 'Failed to load device list')
      }
    } catch (error) {
      console.error('Error loading devices:', error)
      setError('Failed to load device list')
    } finally {
      setLoading(false)
    }
  }

  const handleViewDeviceDetails = (device) => {
    // Opens the DeviceDetailsModal popup
    setDetailsDevice(device)
  }

  const handleCloseDetails = () => {
    setDetailsDevice(null)
  }

  const handleRenameClick = (device) => {
    setRenameDevice(device)
  }

  const handleRenameSuccess = () => {
    loadDevices()
    setRenameDevice(null)
  }

  const handleCloseRenameModal = () => {
    setRenameDevice(null)
  }

  const handleCustomizeClick = (device) => {
    setCustomizeDevice(device)
  }

  const handleCustomizeSuccess = () => {
    loadDevices()
    setCustomizeDevice(null)
  }

  const handleCloseCustomizeModal = () => {
    setCustomizeDevice(null)
  }



  // Define table columns
  const columns = [
    {
      key: 'status',
      label: 'Status',
      render: (value, row) => row.status,
    },
    {
      key: 'name',
      label: 'Name',
    },
    {
      key: 'location',
      label: 'MAC Address',
    },
    {
      key: 'co2',
      label: 'CO₂',
      align: 'right',
    },
    {
      key: 'temp',
      label: 'Temp',
      align: 'right',
    },
    {
      key: 'voltage',
      label: 'Voltage',
      align: 'right',
    },
    {
      key: 'lastSeen',
      label: 'Last Seen',
    },
  ]

  // Format voltage helper function
  const formatVoltage = (voltage) => {
    if (voltage == null) return '—'

    const voltageNum = typeof voltage === 'string'
      ? parseFloat(voltage)
      : typeof voltage === 'number'
        ? voltage
        : null

    if (voltageNum != null && !isNaN(voltageNum) && isFinite(voltageNum)) {
      return `${voltageNum.toFixed(2)}V`
    }
    return '—'
  }

  // Transform devices to table data
  const tableData = devices.map((device) => ({
    id: device.mac_address || device.device_id,
    status: device.status,
    name: device.display_name || device.device_id || 'Unknown',
    location: device.mac_address || device.device_id || '—',
    co2: device.current_readings?.co2 != null ? `${Math.round(device.current_readings.co2)} ppm` : '—',
    temp: device.current_readings?.temperature != null ? `${Math.round(device.current_readings.temperature)}°C` : '—',
    voltage: formatVoltage(device.current_readings?.voltage),
    lastSeen: device.last_seen || '—',
    device,
  }))

  return (
    <div className="flex-1 flex flex-col w-full">
      <div className="flex flex-col gap-6">
        {/* Header */}


        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-900/20 border border-red-700/30 rounded-lg">
            <div className="text-sm font-medium text-red-400">{error}</div>
          </div>
        )}

        {/* Status Bar */}
        {!loading && <AdminStatusBar devices={devices} />}

        {/* Main Content */}
        <div className="flex flex-col gap-6">
          <section>
            <div className="bg-transparent border-none p-0">


              {loading ? (
                <div className="flex flex-col gap-4 p-12 bg-zinc-900/50 border border-white/10 rounded-lg">
                  {/* Skeleton table rows */}
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton variant="circular" width={10} height={10} />
                      <Skeleton variant="text" width="20%" />
                      <Skeleton variant="text" width="25%" />
                      <Skeleton variant="text" width="15%" className="ml-auto" />
                      <Skeleton variant="text" width="15%" />
                      <Skeleton variant="text" width="20%" />
                    </div>
                  ))}
                  <p className="text-sm text-zinc-500 text-center mt-2">
                    Loading devices...
                  </p>
                </div>
              ) : (
                <DataTable
                  columns={columns}
                  data={tableData}
                  onRowClick={(row) => {
                    const deviceIdentifier = row.device?.mac_address || row.device?.device_id
                    navigate(`/admin/device/${deviceIdentifier}`, {
                      state: { device: row.device }
                    })
                  }}
                  actions={{
                    render: (row) => (
                      <DeviceActionsMenu
                        device={row.device}
                        onRename={handleRenameClick}
                        onCustomize={handleCustomizeClick}
                      />
                    )
                  }}
                />
              )}
            </div>
          </section>
        </div>

        {detailsDevice && (
          <DeviceDetailsModal
            device={detailsDevice}
            onClose={handleCloseDetails}
          />
        )}

        {renameDevice && (
          <DeviceRenameModal
            device={renameDevice}
            onClose={handleCloseRenameModal}
            onRenameSuccess={handleRenameSuccess}
          />
        )}

        {customizeDevice && (
          <DeviceCustomizationModal
            device={customizeDevice}
            onClose={handleCloseCustomizeModal}
            onCustomizeSuccess={handleCustomizeSuccess}
          />
        )}
      </div>
    </div>
  )
}

export default AdminPanel
