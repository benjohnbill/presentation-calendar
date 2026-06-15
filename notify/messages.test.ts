import { describe, it, expect } from 'vitest'
import { buildProvisional, buildSessionCreated, buildReminder } from './messages'

const url = 'https://app.example/d/2026-06-20'

describe('buildProvisional', () => {
  it('mentions available members and links the date', () => {
    const msg = buildProvisional({ date: '2026-06-20', mentionIds: ['111', '222'], url })
    expect(msg.content).toContain('2026-06-20')
    expect(msg.content).toContain('<@111>')
    expect(msg.content).toContain('<@222>')
    expect(msg.content).toContain(url)
    expect(msg.allowed_mentions).toEqual({ users: ['111', '222'] })
  })
})

describe('buildSessionCreated', () => {
  it('includes each member time line, suggested time, mentions', () => {
    const msg = buildSessionCreated({
      date: '2026-06-20',
      lines: ['철수  19:00~', '영희  시간무관'],
      suggested: { start: '19:00', end: '24:00' },
      mentionIds: ['111', '222'],
      url,
    })
    expect(msg.content).toContain('철수  19:00~')
    expect(msg.content).toContain('영희  시간무관')
    expect(msg.content).toContain('19:00~24:00')
    expect(msg.content).toContain('<@111>')
    expect(msg.allowed_mentions).toEqual({ users: ['111', '222'] })
  })
  it('omits suggested line when null', () => {
    const msg = buildSessionCreated({
      date: '2026-06-20', lines: ['철수  18:00~19:00'], suggested: null, mentionIds: ['111'], url,
    })
    expect(msg.content).not.toContain('겹치는 시간')
  })
})

describe('buildReminder', () => {
  it('reminds committed members of today session', () => {
    const msg = buildReminder({ date: '2026-06-20', mentionIds: ['111'], url })
    expect(msg.content).toContain('2026-06-20')
    expect(msg.allowed_mentions).toEqual({ users: ['111'] })
  })
})
