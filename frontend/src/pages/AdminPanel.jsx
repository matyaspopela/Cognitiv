import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { adminAPI, historyAPI } from '../services/api'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import DataTable from '../components/ui/DataTable'
import DeviceActionsMenu from '../components/admin/DeviceActionsMenu'
import BoardAnalysisView from '../components/admin/BoardAnalysisView'
import DeviceRenameModal from '../components/admin/DeviceRenameModal'
import DeviceCustomizationModal from '../components/admin/DeviceCustomizationModal'
import DeviceDetailsModal from '../components/admin/DeviceDetailsModal'

const AdminPanel = () => {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedBoard, setSelectedBoard] = useState(null)
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

  const handleDetailsClick = (deviceId) => {
    // Opens the BoardAnalysisView data viewing section
    setSelectedBoard(deviceId)
  }

  const handleCloseAnalysis = () => {
    setSelectedBoard(null)
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

  const handleExportCSV = async (device) => {
    if (!device?.device_id) {
      console.error('Cannot export: missing device_id')
      return
    }

    try {
      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const startIso = thirtyDaysAgo.toISOString()
      const endIso = now.toISOString()

      const response = await historyAPI.exportCSV(startIso, endIso, device.device_id)

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url

      const deviceNameSafe = (device.display_name || device.device_id || 'device').replace(/[^a-z0-9]/gi, '_').toLowerCase()
      const dateStr = now.toISOString().split('T')[0]
      link.download = `cognitiv_${deviceNameSafe}_${dateStr}.csv`

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting CSV:', error)
      alert('Failed to export CSV. Please try again later.')
    }
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
        <header className="mb-2">
          <div className="bg-zinc-900/50 border border-white/10 rounded-lg p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex-1 min-w-[400px]">
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-100 mb-1">
                  Admin Panel
                </h1>
                <p className="text-sm text-zinc-500">
                  Manage and view all devices in the system
                </p>
              </div>
              <Button
                variant="filled"
                size="medium"
                onClick={loadDevices}
                disabled={loading}
                className="flex items-center gap-2"
              >
                <RefreshCw
                  size={18}
                  strokeWidth={2}
                  className={loading ? 'animate-spin' : ''}
                />
                Refresh
              </Button>
            </div>
          </div>
        </header>

        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-900/20 border border-red-700/30 rounded-lg">
            <div className="text-sm font-medium text-red-400">{error}</div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex flex-col gap-6">
          <section>
            <div className="bg-transparent border-none p-0">
              <h2 className="text-lg font-semibold text-zinc-100 tracking-tight mb-4">
                Device List
              </h2>

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
                    // Prefer mac_address over device_id for unique identification
                    const deviceIdentifier = row.device?.mac_address || row.device?.device_id
                    handleDetailsClick(deviceIdentifier)
                  }}
                  actions={{
                    render: (row) => (
                      <DeviceActionsMenu
                        device={row.device}
                        onRename={handleRenameClick}
                        onExport={handleExportCSV}
                        onDetails={handleDetailsClick}
                        onCustomize={handleCustomizeClick}
                      />
                    )
                  }}
                />
              )}
            </div>
          </section>

          {selectedBoard && (
            <BoardAnalysisView deviceId={selectedBoard} onClose={handleCloseAnalysis} />
          )}
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
