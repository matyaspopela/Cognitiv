import React from 'react'
import './MinimalTimeSelector.css'

const MinimalTimeSelector = ({ value, onChange, options = [
  { value: '1h', label: '1H' },
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' }
] }) => {
  return (
    <div className="minimal-time-selector">
      {options.map((option) => (
        <button
          key={option.value}
          className={`minimal-time-selector__button ${value === option.value ? 'minimal-time-selector__button--active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export default MinimalTimeSelector
