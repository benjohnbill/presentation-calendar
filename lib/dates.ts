// Format a Date as YYYY-MM-DD in KST.
export function toKstDateString(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

export function rollingWindowDates(today: Date, weeks: number): string[] {
  const out: string[] = []
  const start = new Date(toKstDateString(today) + 'T00:00:00Z')
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}
