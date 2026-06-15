import { describe, it, expect } from 'vitest'
import { rollingWindowDates } from '@/lib/dates'

describe('rollingWindowDates', () => {
  it('returns N weeks of dates starting today (inclusive)', () => {
    const dates = rollingWindowDates(new Date('2026-06-15T00:00:00+09:00'), 8)
    expect(dates[0]).toBe('2026-06-15')
    expect(dates).toHaveLength(8 * 7)
    expect(dates[dates.length - 1]).toBe('2026-08-09')
  })
})
