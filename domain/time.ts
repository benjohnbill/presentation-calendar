export type TimeWindow = { start: string | null; end: string | null } // 'HH:MM' | null

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function normalizeWindow(w: TimeWindow): { startMin: number; endMin: number } {
  return {
    startMin: w.start === null ? 0 : toMin(w.start),
    endMin: w.end === null ? 1440 : toMin(w.end),
  }
}

export function formatWindow(w: TimeWindow): string {
  if (w.start === null && w.end === null) return '시간무관'
  if (w.end === null) return `${w.start}~`
  if (w.start === null) return `~${w.end}`
  return `${w.start}~${w.end}`
}
