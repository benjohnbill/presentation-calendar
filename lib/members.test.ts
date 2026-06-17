import { describe, it, expect } from 'vitest'
import { selfFirst } from '@/lib/members'

describe('selfFirst', () => {
  const members = [
    { id: 1, name: 'A' },
    { id: 2, name: 'B' },
    { id: 3, name: 'C' },
  ]

  it('moves the current user to the front, keeping the rest in order', () => {
    expect(selfFirst(members, 2).map((m) => m.id)).toEqual([2, 1, 3])
  })

  it('leaves order unchanged when the user is already first', () => {
    expect(selfFirst(members, 1).map((m) => m.id)).toEqual([1, 2, 3])
  })

  it('returns a copy without mutating the input', () => {
    const out = selfFirst(members, 3)
    expect(out.map((m) => m.id)).toEqual([3, 1, 2])
    expect(members.map((m) => m.id)).toEqual([1, 2, 3])
  })

  it('returns the original order when the user is absent', () => {
    expect(selfFirst(members, 99).map((m) => m.id)).toEqual([1, 2, 3])
  })
})
