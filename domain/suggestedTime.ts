import { normalizeWindow, type TimeWindow } from './time'

function fmt(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Returns the first contiguous span where coverage >= threshold, or null.
export function computeSuggestedTime(
  windows: TimeWindow[],
  threshold: number,
): { start: string; end: string } | null {
  const deltas = new Map<number, number>()
  for (const w of windows) {
    const { startMin, endMin } = normalizeWindow(w)
    deltas.set(startMin, (deltas.get(startMin) ?? 0) + 1)
    deltas.set(endMin, (deltas.get(endMin) ?? 0) - 1)
  }
  const points = [...deltas.keys()].sort((a, b) => a - b)
  let running = 0
  let spanStart: number | null = null
  for (let i = 0; i < points.length; i++) {
    running += deltas.get(points[i])!
    if (running >= threshold && spanStart === null) {
      spanStart = points[i]
    } else if (running < threshold && spanStart !== null) {
      return { start: fmt(spanStart), end: fmt(points[i]) }
    }
  }
  return null
}
