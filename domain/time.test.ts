import { describe, it, expect } from 'vitest'
import { normalizeWindow, formatWindow } from './time'

describe('normalizeWindow', () => {
  it('treats both null as full day (anytime)', () => {
    expect(normalizeWindow({ start: null, end: null })).toEqual({ startMin: 0, endMin: 1440 })
  })
  it('open-ended start (7시~) runs to end of day', () => {
    expect(normalizeWindow({ start: '19:00', end: null })).toEqual({ startMin: 1140, endMin: 1440 })
  })
  it('closed window', () => {
    expect(normalizeWindow({ start: '19:00', end: '21:00' })).toEqual({ startMin: 1140, endMin: 1260 })
  })
})

describe('formatWindow', () => {
  it('anytime', () => {
    expect(formatWindow({ start: null, end: null })).toBe('시간무관')
  })
  it('open-ended', () => {
    expect(formatWindow({ start: '19:00', end: null })).toBe('19:00~')
  })
  it('closed', () => {
    expect(formatWindow({ start: '19:00', end: '21:00' })).toBe('19:00~21:00')
  })
})
