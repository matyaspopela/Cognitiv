import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import './DeviceActionsMenu.css'

const DeviceActionsMenu = ({ device, onRename, onDetails, onCustomize }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState({})
  const menuRef = useRef(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) &&
        dropdownRef.current && !dropdownRef.current.contains(event.target)) {
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

  // Calculate dropdown position when opened - using fixed positioning via portal
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const viewportWidth = window.innerWidth
      const dropdownWidth = 180
      const dropdownHeight = 180
      const gap = 4

      let top, left

      // Position below or above based on available space
      if (rect.bottom + dropdownHeight + gap > viewportHeight && rect.top > dropdownHeight + gap) {
        // Open above
        top = rect.top - dropdownHeight - gap
      } else {
        // Open below
        top = rect.bottom + gap
      }

      // Position left or right based on available space
      if (rect.right > viewportWidth - dropdownWidth - 20) {
        // Align to left edge of button, but ensure it doesn't go off left side
        left = Math.max(10, rect.right - dropdownWidth)
      } else {
        // Align to right edge of button
        left = rect.right - dropdownWidth
      }

      setDropdownStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${dropdownWidth}px`,
      })
    }
  }, [isOpen])

  const handleRename = () => {
    setIsOpen(false)
    onRename(device)
  }



  const handleDetails = () => {
    setIsOpen(false)
    // Prefer mac_address over device_id for unique identification
    const deviceIdentifier = device.mac_address || device.device_id
    onDetails(deviceIdentifier)
  }

  const handleCustomize = () => {
    setIsOpen(false)
    onCustomize(device)
  }

  const dropdown = isOpen ? (
    <div
      ref={dropdownRef}
      className="device-actions-menu__dropdown device-actions-menu__dropdown--portal"
      style={dropdownStyle}
    >
      <button className="device-actions-menu__item" onClick={handleDetails}>
        <span>View Details</span>
      </button>
      {device.mac_address && onCustomize && (
        <button className="device-actions-menu__item" onClick={handleCustomize}>
          <span>Customize</span>
        </button>
      )}

    </div>
  ) : null

  return (
    <div className="device-actions-menu" ref={menuRef}>
      <button
        className="device-actions-menu__trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Actions"
      >
        ⋯
      </button>
      {dropdown && createPortal(dropdown, document.body)}
    </div>
  )
}

export default DeviceActionsMenu



