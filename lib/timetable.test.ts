import { describe, it, expect } from 'vitest'
import { applyOptimistic, type TimetableDay } from '@/lib/timetable'

// THRESHOLD is 4: three members overlap, a fourth commit closes the band.
const base: TimetableDay[] = [
  {
    date: '2026-06-20',
    comm: [
      { memberId: 1, timeStart: '19:00', timeEnd: '22:00' },
      { memberId: 2, timeStart: '19:00', timeEnd: '22:00' },
      { memberId: 3, timeStart: '19:00', timeEnd: '22:00' },
    ],
    tops: [],
    suggested: null,
  },
  { date: '2026-06-21', comm: [], tops: [], suggested: null },
]

describe('applyOptimistic', () => {
  it('adds a new commit and recomputes the overlap band', () => {
    const next = applyOptimistic(base, {
      type: 'commit',
      date: '2026-06-20',
      memberId: 4,
      window: { start: '19:00', end: '22:00' },
    })
    const day = next.find((d) => d.date === '2026-06-20')!
    expect(day.comm).toHaveLength(4)
    expect(day.suggested).toEqual({ start: '19:00', end: '22:00' })
  })

  it('updates an existing commit in place rather than duplicating it', () => {
    const next = applyOptimistic(base, {
      type: 'commit',
      date: '2026-06-20',
      memberId: 2,
      window: { start: '20:00', end: '23:00' },
    })
    const day = next.find((d) => d.date === '2026-06-20')!
    expect(day.comm.filter((c) => c.memberId === 2)).toHaveLength(1)
    expect(day.comm.find((c) => c.memberId === 2)).toMatchObject({ timeStart: '20:00', timeEnd: '23:00' })
  })

  it('removes a commit on uncommit and clears a band that drops below threshold', () => {
    const four = applyOptimistic(base, {
      type: 'commit',
      date: '2026-06-20',
      memberId: 4,
      window: { start: '19:00', end: '22:00' },
    })
    const next = applyOptimistic(four, { type: 'uncommit', date: '2026-06-20', memberId: 4 })
    const day = next.find((d) => d.date === '2026-06-20')!
    expect(day.comm).toHaveLength(3)
    expect(day.suggested).toBeNull()
  })

  it('does not touch other days or mutate the input', () => {
    const next = applyOptimistic(base, {
      type: 'commit',
      date: '2026-06-20',
      memberId: 4,
      window: { start: '19:00', end: '22:00' },
    })
    expect(next.find((d) => d.date === '2026-06-21')).toBe(base[1])
    expect(base[0].comm).toHaveLength(3)
  })
})
