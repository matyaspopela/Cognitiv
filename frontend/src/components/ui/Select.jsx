import { useState, useRef, useEffect } from 'react'
import './Select.css'

const Select = ({
  label,
  value,
  onChange,
  options = [],
  placeholder = ' vyberte možnost',
  error = false,
  helperText,
  disabled = false,
  required = false,
  fullWidth = false,
  className = '',
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const selectRef = useRef(null)
  const dropdownRef = useRef(null)

  const hasValue = value !== '' && value !== null && value !== undefined
  const selectedOption = options.find(opt => {
    const optValue = typeof opt === 'string' ? opt : opt.value
    return optValue === value
  })
  const displayValue = selectedOption 
    ? (typeof selectedOption === 'string' ? selectedOption : selectedOption.label || selectedOption.value)
    : ''

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        selectRef.current &&
        !selectRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false)
        setFocused(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen)
      setFocused(!isOpen)
    }
  }

  const handleSelect = (optionValue) => {
    if (onChange) {
      const syntheticEvent = {
        target: { value: optionValue }
      }
      onChange(syntheticEvent)
    }
    setIsOpen(false)
    setFocused(false)
  }

  const isFloating = focused || hasValue || isOpen

  return (
    <div className={`md3-select ${fullWidth ? 'md3-select--full-width' : ''} ${className}`}>
      <div
        ref={selectRef}
        className={`md3-select__container ${focused || isOpen ? 'md3-select__container--focused' : ''} ${error ? 'md3-select__container--error' : ''} ${disabled ? 'md3-select__container--disabled' : ''} ${isOpen ? 'md3-select__container--open' : ''}`}
        onClick={handleToggle}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleToggle()
          }
        }}
        {...props}
      >
        <div className="md3-select__content">
          {hasValue ? (
            <span className="md3-select__value">{displayValue}</span>
          ) : label ? null : (
            <span className="md3-select__placeholder">{placeholder}</span>
          )}
        </div>
        <div className={`md3-select__icon ${isOpen ? 'md3-select__icon--open' : ''}`}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M5 7.5L10 12.5L15 7.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="md3-select__underline"></div>
        {(focused || isOpen) && <div className="md3-select__underline--active"></div>}
      </div>
      {label && (
        <label
          className={`md3-select__label ${isFloating ? 'md3-select__label--floating' : ''}`}
          onClick={() => !disabled && handleToggle()}
        >
          {label}
          {required && <span className="md3-select__required">*</span>}
        </label>
      )}
      {isOpen && (
        <div ref={dropdownRef} className="md3-select__dropdown">
          <div className="md3-select__dropdown-content">
            {options.map((option, index) => {
              const optionValue = typeof option === 'string' ? option : option.value
              const optionLabel = typeof option === 'string' ? option : option.label || option.value
              const isSelected = optionValue === value

              return (
                <div
                  key={optionValue || index}
                  className={`md3-select__option ${isSelected ? 'md3-select__option--selected' : ''}`}
                  onClick={() => handleSelect(optionValue)}
                  role="option"
                  aria-selected={isSelected}
                >
                  <span className="md3-select__option-text">{optionLabel}</span>
                  {isSelected && (
                    <svg
                      className="md3-select__option-check"
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M16.667 5L7.5 14.167 3.333 10"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {helperText && (
        <div className={`md3-select__helper ${error ? 'md3-select__helper--error' : ''}`}>
          {helperText}
        </div>
      )}
    </div>
  )
}

export default Select

