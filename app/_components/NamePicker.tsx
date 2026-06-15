'use client'
import { useEffect, useState } from 'react'

export type Member = { id: number; name: string }

export function useIdentity() {
  const [id, setId] = useState<number | null>(null)
  // `ready` is false until localStorage has been read, so the UI can avoid
  // flashing the identity gate to returning users before hydration.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    // localStorage is unavailable during SSR, so this client-only read is an
    // intentional post-mount set-state (the safe path to avoid a hydration mismatch).
    const v = localStorage.getItem('memberId')
    /* eslint-disable react-hooks/set-state-in-effect */
    if (v) setId(Number(v))
    setReady(true)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])
  const pick = (memberId: number) => {
    localStorage.setItem('memberId', String(memberId))
    setId(memberId)
  }
  return { id, ready, pick }
}

export function NamePicker({ members, value, onPick }: { members: Member[]; value: number | null; onPick: (id: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {members.map((m) => (
        <button
          key={m.id}
          onClick={() => onPick(m.id)}
          className={`rounded-full px-4 py-1.5 text-sm transition ${value === m.id ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          {m.name}
        </button>
      ))}
    </div>
  )
}
