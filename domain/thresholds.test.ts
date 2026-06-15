import { describe, it, expect } from 'vitest'
import { THRESHOLD, shouldFireProvisional, shouldCreateSession } from './thresholds'

describe('shouldFireProvisional', () => {
  it('fires when count reaches threshold, no session, not yet notified', () => {
    expect(shouldFireProvisional({ availableCount: 4, sessionExists: false, alreadyNotified: false })).toBe(true)
  })
  it('does not fire below threshold', () => {
    expect(shouldFireProvisional({ availableCount: 3, sessionExists: false, alreadyNotified: false })).toBe(false)
  })
  it('does not fire if already notified (idempotent)', () => {
    expect(shouldFireProvisional({ availableCount: 5, sessionExists: false, alreadyNotified: true })).toBe(false)
  })
  it('does not fire if a session already exists', () => {
    expect(shouldFireProvisional({ availableCount: 5, sessionExists: true, alreadyNotified: false })).toBe(false)
  })
})

describe('shouldCreateSession', () => {
  it('creates when commits reach threshold and no session yet', () => {
    expect(shouldCreateSession({ commitCount: 4, sessionExists: false })).toBe(true)
  })
  it('does not create below threshold', () => {
    expect(shouldCreateSession({ commitCount: 3, sessionExists: false })).toBe(false)
  })
  it('does not create twice (session already exists)', () => {
    expect(shouldCreateSession({ commitCount: 6, sessionExists: true })).toBe(false)
  })
})

it('threshold is 4', () => {
  expect(THRESHOLD).toBe(4)
})
