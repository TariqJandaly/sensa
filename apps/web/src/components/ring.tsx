import type { ReadingStatus } from '@sensa/contracts'

type RingStatus = ReadingStatus | 'SOS'

const STATUS_STROKE: Record<RingStatus, string> = {
  SAFE: 'var(--safe-ink)',
  WATCH: 'var(--watch-ink)',
  ALERT: 'var(--alert-ink)',
  SOS: 'var(--alert-ink)',
}

/**
 * The signature element: the breathing status ring.
 * One ring, one authority. The halo breathes calm at SAFE, urgent at
 * ALERT/SOS, and holds still under prefers-reduced-motion.
 */
export function StatusRing({
  status,
  initials,
  size = 128,
  label,
}: {
  status: RingStatus
  initials?: string
  size?: number
  label: string
}) {
  const stroke = STATUS_STROKE[status] ?? 'var(--primary)'
  const urgent = status === 'ALERT' || status === 'SOS'
  const haloClass = urgent ? 'ring-urgent' : 'ring-breath'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={label}
      className="shrink-0 select-none"
    >
      <circle
        className={haloClass}
        cx="50"
        cy="50"
        r="46"
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        opacity="0.6"
      />
      <circle cx="50" cy="50" r="38" fill="none" stroke={stroke} strokeWidth="5" />
      <circle cx="50" cy="50" r="31.5" fill="var(--surface)" />
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="30"
        fontWeight="800"
        fill={stroke}
        fontFamily="inherit"
      >
        {initials ?? 'س'}
      </text>
    </svg>
  )
}
