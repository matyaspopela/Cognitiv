import { useState, useRef, useEffect } from 'react'
import './TextField.css'

const TextField = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  error = false,
  helperText,
  disabled = false,
  required = false,
  fullWidth = false,
  className = '',
  ...props
}) => {
  const [focused, setFocused] = useState(false)
  const [hasValue, setHasValue] = useState(!!value)
  const inputRef = useRef(null)

  useEffect(() => {
    setHasValue(!!value)
  }, [value])

  const handleFocus = (e) => {
    setFocused(true)
    if (props.onFocus) props.onFocus(e)
  }

  const handleBlur = (e) => {
    setFocused(false)
    if (props.onBlur) props.onBlur(e)
  }

  const handleChange = (e) => {
    setHasValue(!!e.target.value)
    if (onChange) onChange(e)
  }

  const isFloating = focused || hasValue

  return (
    <div className={`md3-text-field ${fullWidth ? 'md3-text-field--full-width' : ''} ${className}`}>
      <div className={`md3-text-field__container ${focused ? 'md3-text-field__container--focused' : ''} ${error ? 'md3-text-field__container--error' : ''} ${disabled ? 'md3-text-field__container--disabled' : ''}`}>
        <input
          ref={inputRef}
          type={type}
          value={value || ''}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          required={required}
          placeholder={isFloating ? placeholder : ''}
          className="md3-text-field__input"
          {...props}
        />
        {label && (
          <label
            className={`md3-text-field__label ${isFloating ? 'md3-text-field__label--floating' : ''}`}
            onClick={() => inputRef.current?.focus()}
          >
            {label}
            {required && <span className="md3-text-field__required">*</span>}
          </label>
        )}
        <div className="md3-text-field__underline"></div>
        {focused && <div className="md3-text-field__underline--active"></div>}
      </div>
      {helperText && (
        <div className={`md3-text-field__helper ${error ? 'md3-text-field__helper--error' : ''}`}>
          {helperText}
        </div>
      )}
    </div>
  )
}

export default TextField










