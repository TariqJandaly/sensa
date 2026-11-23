interface SparklineProps {
  values: (number | null)[]
  stroke: string
  width?: number
  height?: number
}

/** Small recent-history line for a vital. Null gaps break the path. */
export function Sparkline({ values, stroke, width = 72, height = 26 }: SparklineProps) {
  const clean = values.filter((v): v is number => v != null)
  const viewBox = `0 0 ${width} ${height}`

  if (clean.length < 2) {
    return (
      <svg
        viewBox={viewBox}
        className="block h-[26px] w-full"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="var(--line-strong)"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
      </svg>
    )
  }

  let min = Math.min(...clean)
  let max = Math.max(...clean)
  if (max - min < 0.001) {
    min -= 1
    max += 1
  }
  const pad = 3
  const span = max - min
  const stepX = width / (values.length - 1)
  const x = (i: number) => i * stepX
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2)

  let path = ''
  let open = false
  values.forEach((v, i) => {
    if (v == null) {
      open = false
      return
    }
    path += `${open ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `
    open = true
  })

  const lastIdx = (() => {
    for (let i = values.length - 1; i >= 0; i--) {
      if (values[i] != null) return i
    }
    return 0
  })()

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="none"
      className="block h-[26px] w-full"
      aria-hidden="true"
    >
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
      <circle
        cx={x(lastIdx)}
        cy={y(values[lastIdx] as number)}
        r="2.4"
        fill={stroke}
        stroke="none"
      />
    </svg>
  )
}
