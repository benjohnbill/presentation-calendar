// Month-view helpers + per-member colour palette. Pure; safe on server and client.
import { toKstDateString } from './dates'

const pad = (n: number) => String(n).padStart(2, '0')

export type MonthAnchor = { year: number; month0: number; label: string } // month0: 0-11

const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

// KST year/month of "today".
function kstYM(today: Date): { y: number; m0: number } {
  const kst = new Date(today.getTime() + 9 * 60 * 60 * 1000)
  return { y: kst.getUTCFullYear(), m0: kst.getUTCMonth() }
}

// The N forward months to show, starting at the current month.
export function monthAnchors(today: Date, count: number): MonthAnchor[] {
  const { y, m0 } = kstYM(today)
  return Array.from({ length: count }, (_, i) => {
    const year = y + Math.floor((m0 + i) / 12)
    const month0 = (m0 + i) % 12
    return { year, month0, label: `${year}년 ${MONTH_LABELS[month0]}` }
  })
}

// Flat list of every YYYY-MM-DD across the N forward months (for one availability fetch).
export function monthWindowDates(today: Date, count: number): string[] {
  const out: string[] = []
  for (const { year, month0 } of monthAnchors(today, count)) {
    const days = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
    for (let d = 1; d <= days; d++) out.push(`${year}-${pad(month0 + 1)}-${pad(d)}`)
  }
  return out
}

// 6-week grid (Sun-first) for a month: each cell is a YYYY-MM-DD or null (padding).
export function monthGrid(year: number, month0: number): (string | null)[] {
  const firstDow = new Date(Date.UTC(year, month0, 1)).getUTCDay() // 0=Sun
  const days = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= days; d++) cells.push(`${year}-${pad(month0 + 1)}-${pad(d)}`)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function todayKst(today: Date): string {
  return toKstDateString(today)
}

// Distinct, vivid colours assigned to members by their position in the roster.
const PALETTE = ['#f97316', '#0ea5e9', '#8b5cf6', '#10b981', '#f43f5e', '#eab308', '#14b8a6', '#ec4899', '#6366f1', '#84cc16']

export function buildColorMap(memberIds: number[]): Record<number, string> {
  const map: Record<number, string> = {}
  memberIds.forEach((id, i) => (map[id] = PALETTE[i % PALETTE.length]))
  return map
}
