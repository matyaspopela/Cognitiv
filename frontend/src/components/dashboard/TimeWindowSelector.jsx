import Button from '../ui/Button'
import './TimeWindowSelector.css'

/**
 * TimeWindowSelector Component
 * Allows users to select time window for data visualization
 */
const TimeWindowSelector = ({ value, onChange }) => {
  const options = [
    { value: '1h', label: '1 Hour' },
    { value: '24h', label: '24 Hours' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' }
  ]

  return (
    <div className="time-window-selector">
      <div className="time-window-selector__label">Time Period:</div>
      <div className="time-window-selector__buttons">
        {options.map((option) => (
          <Button
            key={option.value}
            variant={value === option.value ? 'filled' : 'outlined'}
            size="medium"
            onClick={() => onChange(option.value)}
            className={`time-window-selector__button ${value === option.value ? 'time-window-selector__button--active' : ''
              }`}
            aria-pressed={value === option.value}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

export default TimeWindowSelector









