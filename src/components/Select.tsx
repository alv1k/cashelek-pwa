import { useState, useRef, useEffect } from 'react'

interface Option {
  value: string
  label: string
}

interface Props {
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export default function Select({ options, value, onChange, placeholder = 'Выбрать...', className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className={`select-wrapper ${className}`}>
      <button
        type="button"
        className="select-trigger"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={selected ? 'select-value' : 'select-placeholder'}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          className={`select-arrow ${open ? 'select-arrow-open' : ''}`}
          width="12"
          height="8"
          viewBox="0 0 12 8"
        >
          <path d="M1.4 0L6 4.6 10.6 0 12 1.4l-6 6-6-6z" />
        </svg>
      </button>

      {open && (
        <div className="select-dropdown">
          {placeholder && (
            <div
              className={`select-option ${!value ? 'select-option-active' : ''}`}
              onClick={() => { onChange(''); setOpen(false) }}
            >
              {placeholder}
            </div>
          )}
          {options.map((o) => (
            <div
              key={o.value}
              className={`select-option ${o.value === value ? 'select-option-active' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false) }}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
