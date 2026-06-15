import { describe, it, expect } from 'vitest'
import { computeSuggestedTime } from './suggestedTime'

describe('computeSuggestedTime', () => {
  it('returns the span where >=4 windows overlap', () => {
    // 3 people from 19:00~, 1 person 20:00~22:00 -> 4 overlap only in 20:00..22:00
    const windows = [
      { start: '19:00', end: null },
      { start: '19:00', end: null },
      { start: '19:00', end: null },
      { start: '20:00', end: '22:00' },
    ]
    expect(computeSuggestedTime(windows, 4)).toEqual({ start: '20:00', end: '22:00' })
  })
  it('anytime members count across the whole day', () => {
    const windows = [
      { start: null, end: null },
      { start: null, end: null },
      { start: '19:00', end: null },
      { start: '19:00', end: null },
    ]
    expect(computeSuggestedTime(windows, 4)).toEqual({ start: '19:00', end: '24:00' })
  })
  it('returns null when overlap never reaches threshold', () => {
    const windows = [
      { start: '18:00', end: '19:00' },
      { start: '20:00', end: '21:00' },
      { start: '22:00', end: '23:00' },
      { start: '08:00', end: '09:00' },
    ]
    expect(computeSuggestedTime(windows, 4)).toBeNull()
  })
})
