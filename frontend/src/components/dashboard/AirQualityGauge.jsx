import { useState, useEffect } from 'react'

const CX = 110
const CY = 110
const R = 90
const STROKE_WIDTH = 18

// CO₂ zones mapped to arc segments (0° = left, 180° = right)
const ZONES = [
  { start: 0,   end: 45,  color: '#16A34A' }, // good    < 800 ppm
  { start: 45,  end: 90,  color: '#D97706' }, // warning  800–1200
  { start: 90,  end: 135, color: '#EA580C' }, // poor    1200–1800
  { start: 135, end: 180, color: '#DC2626' }, // critical >1800
]

/** Convert an angle (0–180°, where 0 = leftmost) to SVG arc point on the semicircle */
const angleToPoint = (deg) => {
  const rad = ((deg + 180) * Math.PI) / 180
  return {
    x: CX + R * Math.cos(rad),
    y: CY + R * Math.sin(rad),
  }
}

/** Build a large-arc SVG path string for one arc segment */
const arcPath = (startDeg, endDeg) => {
  const s = angleToPoint(startDeg)
  const e = angleToPoint(endDeg)
  const span = endDeg - startDeg
  const largeArc = span > 180 ? 1 : 0
  return `M ${s.x} ${s.y} A ${R} ${R} 0 ${largeArc} 1 ${e.x} ${e.y}`
}

/** Map CO₂ ppm to angle on the 180° arc */
const ppmToAngle = (co2) => {
  if (co2 == null) return 0
  const clamped = Math.max(400, Math.min(2000, co2))
  return ((clamped - 400) / 1600) * 180
}

const AirQualityGauge = ({ co2, status, statusColor }) => {
  const [displayAngle, setDisplayAngle] = useState(0)
  const [textVisible, setTextVisible] = useState(false)

  useEffect(() => {
    // Small delay lets the component mount before triggering CSS transition
    const t1 = setTimeout(() => setDisplayAngle(ppmToAngle(co2)), 80)
    const t2 = setTimeout(() => setTextVisible(true), 600)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, []) // only on mount for initial animation

  // On subsequent co2 changes, update immediately with spring transition
  useEffect(() => {
    setDisplayAngle(ppmToAngle(co2))
    setTextVisible(true)
  }, [co2])

  const pointer = angleToPoint(displayAngle)

  return (
    <div className="w-full flex flex-col items-center">
      <svg
        viewBox="0 0 220 120"
        className="w-full max-w-[420px]"
        style={{ overflow: 'visible' }}
        aria-label={`Air quality gauge: ${status ?? '—'}`}
      >
        {/* Background track */}
        <path
          d={arcPath(0, 180)}
          fill="none"
          stroke="#E7E5E4"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
        />

        {/* Colored zone segments */}
        {ZONES.map((z) => (
          <path
            key={z.start}
            d={arcPath(z.start, z.end)}
            fill="none"
            stroke={z.color}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="butt"
            opacity="0.85"
          />
        ))}

        {/* Pointer line from center to arc */}
        <line
          x1={CX}
          y1={CY}
          x2={pointer.x}
          y2={pointer.y}
          stroke={statusColor ?? '#78716C'}
          strokeWidth={2}
          strokeLinecap="round"
          style={{
            transition: 'x2 0.6s cubic-bezier(0.34,1.56,0.64,1), y2 0.6s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        />

        {/* Pointer dot on arc */}
        <circle
          cx={pointer.cx ?? pointer.x}
          cy={pointer.cy ?? pointer.y}
          r={7}
          fill="white"
          stroke={statusColor ?? '#78716C'}
          strokeWidth={3}
          style={{
            filter: `drop-shadow(0 0 4px ${statusColor ?? '#78716C'}88)`,
            transition: 'cx 0.6s cubic-bezier(0.34,1.56,0.64,1), cy 0.6s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        />

        {/* Center pivot dot */}
        <circle cx={CX} cy={CY} r={4} fill={statusColor ?? '#78716C'} />
      </svg>

      {/* Text below gauge */}
      <div
        className="flex flex-col items-center mt-[-8px]"
        style={{
          opacity: textVisible ? 1 : 0,
          transition: 'opacity 0.4s ease 0.2s',
        }}
      >
        <span
          className="text-2xl font-bold tracking-tight leading-none"
          style={{ color: statusColor ?? '#78716C' }}
        >
          {status ?? '—'}
        </span>
        {co2 != null && (
          <span className="text-sm font-mono text-stone-400 mt-1">
            {Math.round(co2)} ppm
          </span>
        )}
      </div>
    </div>
  )
}

export default AirQualityGauge
