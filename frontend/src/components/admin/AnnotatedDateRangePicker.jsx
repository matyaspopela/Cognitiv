import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

/** Format a Date to 'YYYY-MM-DD' in local time */
const toLocalDateStr = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Parse 'YYYY-MM-DD' to a local-midnight Date */
const parseLocalDate = (str) => {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * AnnotatedDateRangePicker
 *
 * Props:
 *   availableDates  – Set<string> of 'YYYY-MM-DD' strings that have annotated data
 *   onApply         – ({ start: string, end: string }) => void   (ISO datetime strings)
 */
const AnnotatedDateRangePicker = ({ availableDates = new Set(), onApply }) => {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth()) // 0-indexed

  // Selection state: first click = start, second = end
  const [selecting, setSelecting] = useState(null)   // 'YYYY-MM-DD' | null — the anchor
  const [start, setStart] = useState(null)           // committed start
  const [end, setEnd] = useState(null)               // committed end
  const [hover, setHover] = useState(null)           // 'YYYY-MM-DD' | null

  // ── Calendar grid ────────────────────────────────────────────────────────
  const days = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1)
    // Monday = 0 offset
    const startOffset = (firstDay.getDay() + 6) % 7
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()

    const cells = []

    // Trailing days from previous month
    for (let i = startOffset - 1; i >= 0; i--) {
      cells.push({ day: daysInPrevMonth - i, currentMonth: false, dateStr: null })
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewYear, viewMonth, d)
      cells.push({ day: d, currentMonth: true, dateStr: toLocalDateStr(date) })
    }

    // Leading days of next month to fill grid
    const remaining = (7 - (cells.length % 7)) % 7
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, currentMonth: false, dateStr: null })
    }

    return cells
  }, [viewYear, viewMonth])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  // ── Click logic ──────────────────────────────────────────────────────────
  const handleDayClick = (dateStr) => {
    if (!dateStr) return

    if (!selecting) {
      // First click — set anchor
      setSelecting(dateStr)
      setStart(dateStr)
      setEnd(null)
    } else {
      // Second click — commit range (ensure start < end)
      const anchor = parseLocalDate(selecting)
      const clicked = parseLocalDate(dateStr)
      if (clicked < anchor) {
        setStart(dateStr)
        setEnd(selecting)
      } else {
        setStart(selecting)
        setEnd(dateStr)
      }
      setSelecting(null)
      setHover(null)
    }
  }

  // ── Range helpers ─────────────────────────────────────────────────────────
  const effectiveEnd = selecting && hover ? hover : end

  const inRange = (dateStr) => {
    if (!start || !effectiveEnd || !dateStr) return false
    const s = start < effectiveEnd ? start : effectiveEnd
    const e = start < effectiveEnd ? effectiveEnd : start
    return dateStr > s && dateStr < e
  }
  const isStart = (dateStr) => dateStr && dateStr === (start < effectiveEnd ? start : effectiveEnd)
  const isEnd   = (dateStr) => dateStr && effectiveEnd && dateStr === (start < effectiveEnd ? effectiveEnd : start)

  // ── Apply ─────────────────────────────────────────────────────────────────
  const handleApply = () => {
    if (!start || !end) return
    const s = start < end ? start : end
    const e = start < end ? end : start
    onApply({
      start: new Date(parseLocalDate(s).setHours(0, 0, 0, 0)).toISOString(),
      end:   new Date(parseLocalDate(e).setHours(23, 59, 59, 999)).toISOString(),
    })
  }

  const canApply = start && end && start !== end

  return (
    <div className="flex flex-col gap-4 p-4 bg-white border border-stone-200 rounded-xl shadow-sm">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-md hover:bg-stone-100 text-stone-500 transition-colors"
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </button>
        <span className="text-[11px] font-bold uppercase tracking-widest text-stone-700">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-md hover:bg-stone-100 text-stone-500 transition-colors"
        >
          <ChevronRight size={16} strokeWidth={2} />
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-0.5">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[9px] font-bold uppercase tracking-wider text-stone-400 py-1">
            {d}
          </div>
        ))}

        {/* Day cells */}
        {days.map((cell, i) => {
          const hasData   = cell.dateStr && availableDates.has(cell.dateStr)
          const isRangeStart = isStart(cell.dateStr)
          const isRangeEnd   = isEnd(cell.dateStr)
          const isInRange    = inRange(cell.dateStr)
          const isSelected   = isRangeStart || isRangeEnd

          let cellClass = 'relative flex flex-col items-center justify-center h-8 text-[11px] rounded-md transition-all select-none '

          if (!cell.currentMonth) {
            cellClass += 'text-stone-200 cursor-default'
          } else if (isSelected) {
            cellClass += 'bg-amber-600 text-white font-bold cursor-pointer'
          } else if (isInRange) {
            cellClass += 'bg-amber-100 text-amber-900 cursor-pointer hover:bg-amber-200'
          } else if (hasData) {
            cellClass += 'text-stone-800 font-medium cursor-pointer hover:bg-amber-50'
          } else {
            cellClass += 'text-stone-400 cursor-pointer hover:bg-stone-50'
          }

          return (
            <div
              key={i}
              className={cellClass}
              onClick={() => cell.currentMonth && handleDayClick(cell.dateStr)}
              onMouseEnter={() => selecting && cell.dateStr && setHover(cell.dateStr)}
              onMouseLeave={() => setHover(null)}
            >
              <span>{cell.currentMonth ? cell.day : ''}</span>
              {/* Data-presence dot */}
              {hasData && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-500" />
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-[9px] font-medium text-stone-400 uppercase tracking-wider">Has data</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded bg-amber-600" />
          <span className="text-[9px] font-medium text-stone-400 uppercase tracking-wider">Selected</span>
        </div>
      </div>

      {/* Selection status + Apply */}
      <div className="flex items-center justify-between pt-1 border-t border-stone-100">
        <span className="text-[10px] text-stone-400">
          {!start
            ? 'Click a start date'
            : !end
              ? 'Click an end date'
              : `${start} → ${end}`}
        </span>
        <button
          onClick={handleApply}
          disabled={!canApply}
          className="px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-amber-600 text-white hover:bg-amber-700"
        >
          Apply
        </button>
      </div>
    </div>
  )
}

export default AnnotatedDateRangePicker
