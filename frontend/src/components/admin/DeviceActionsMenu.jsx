import { useState, useRef, useEffect } from 'react'
import './DeviceActionsMenu.css'

const DeviceActionsMenu = ({ device, onRename, onExport, onDetails }) => {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleRename = () => {
    setIsOpen(false)
    onRename(device)
  }

  const handleExport = () => {
    setIsOpen(false)
    onExport(device)
  }

  const handleDetails = () => {
    setIsOpen(false)
    // Prefer mac_address over device_id for unique identification
    const deviceIdentifier = device.mac_address || device.device_id
    onDetails(deviceIdentifier)
  }

  return (
    <div className="device-actions-menu" ref={menuRef}>
      <button
        className="device-actions-menu__trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Actions"
      >
        ⋯
      </button>
      {isOpen && (
        <div className="device-actions-menu__dropdown">
          <button className="device-actions-menu__item" onClick={handleDetails}>
            <span>View Details</span>
          </button>
          {device.mac_address && (
            <button className="device-actions-menu__item" onClick={handleRename}>
              <span>Rename</span>
            </button>
          )}
          <button className="device-actions-menu__item" onClick={handleExport}>
            <span>Export CSV</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default DeviceActionsMenu



