import { useState, useEffect, useRef } from 'react'

const CX = 110
const CY = 110
const R = 90

// Total arc length of the 180° semicircle (used for stroke-dashoffset animation)
const ARC_LEN = Math.PI * R

const TRACK_W = 3
const PROGRESS_W = 5

// Subtle tick marks at zone boundaries (400→800, 800→1200, 1200→1800 ppm)
const TICK_ANGLES = [45, 90, 135]

const angleToPoint = (deg, radius = R) => {
  const rad = ((deg + 180) * Math.PI) / 180
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) }
}

/** Full 180° arc path — used for both background track and the dashoffset progress arc. */
const FULL_ARC = (() => {
  const s = angleToPoint(0)
  const e = angleToPoint(180)
  return `M ${s.x} ${s.y} A ${R} ${R} 0 0 1 ${e.x} ${e.y}`
})()

const ppmToAngle = (co2) => {
  if (co2 == null) return 0
  return ((Math.max(400, Math.min(2000, co2)) - 400) / 1600) * 180
}

/**
 * AirQualityGauge — boxless hero gauge with status text seated inside the arch bowl.
 * Container has a fixed aspect ratio so it never gets stretched.
 */
const AirQualityGauge = ({ co2, status, statusColor }) => {
  const [displayAngle, setDisplayAngle] = useState(0)
  const [textVisible, setTextVisible] = useState(false)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      const t1 = setTimeout(() => setDisplayAngle(ppmToAngle(co2)), 100)
      const t2 = setTimeout(() => setTextVisible(true), 500)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
    setDisplayAngle(ppmToAngle(co2))
    setTextVisible(true)
  }, [co2])

  const color = statusColor ?? '#A8A29E'
  const dashOffset = ARC_LEN * (1 - displayAngle / 180)
  const rotDeg = displayAngle - 180

  return (
    <div
      className="relative w-full max-w-[460px] mx-auto select-none"
      style={{ aspectRatio: '220 / 130' }}
    >
      <svg
        viewBox="0 0 220 130"
        className="absolute inset-0 w-full h-full"
        style={{ overflow: 'visible' }}
        aria-label={`Air quality: ${status ?? '—'}`}
      >
        {/* Background track */}
        <path
          d={FULL_ARC}
          fill="none"
          stroke="#E7E5E4"
          strokeWidth={TRACK_W}
          strokeLinecap="round"
        />

        {/* Zone boundary ticks — precision instrument feel */}
        {TICK_ANGLES.map((deg) => {
          const inner = angleToPoint(deg, R - 7)
          const outer = angleToPoint(deg, R + 7)
          return (
            <line
              key={deg}
              x1={inner.x} y1={inner.y}
              x2={outer.x} y2={outer.y}
              stroke="#D6D3D1"
              strokeWidth={1}
              strokeLinecap="round"
            />
          )
        })}

        {/* Progress arc — animates via stroke-dashoffset */}
        <path
          d={FULL_ARC}
          fill="none"
          stroke={color}
          strokeWidth={PROGRESS_W}
          strokeLinecap="round"
          strokeDasharray={ARC_LEN}
          strokeDashoffset={dashOffset}
          style={{
            transition: 'stroke-dashoffset 0.7s cubic-bezier(0.22, 1, 0.36, 1), stroke 0.4s ease',
          }}
        />

        {/* Indicator dot — rotates via CSS transform */}
        <g
          style={{
            transformOrigin: `${CX}px ${CY}px`,
            transform: `rotate(${rotDeg}deg)`,
            transition: 'transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <circle
            cx={CX + R}
            cy={CY}
            r={6}
            fill="white"
            stroke={color}
            strokeWidth={2.5}
            style={{
              filter: `drop-shadow(0 0 5px ${color}55)`,
              transition: 'stroke 0.4s ease',
            }}
          />
        </g>
      </svg>

      {/* Status + value, seated inside the arch bowl */}
      <div
        className="absolute inset-x-0 flex flex-col items-center pointer-events-none"
        style={{
          bottom: '10%',
          opacity: textVisible ? 1 : 0,
          transition: 'opacity 0.5s ease 0.15s',
        }}
      >
        <span
          className="text-[2.5rem] md:text-[2.75rem] font-semibold tracking-tight leading-none"
          style={{ color }}
        >
          {status ?? '—'}
        </span>
        {co2 != null && (
          <span className="text-sm font-mono text-stone-400 mt-2.5 tabular-nums">
            {Math.round(co2)} <span className="text-stone-300">ppm</span>
          </span>
        )}
      </div>
    </div>
  )
}

export default AirQualityGauge
