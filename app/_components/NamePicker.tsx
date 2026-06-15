'use client'
import { useEffect, useState } from 'react'

export type Member = { id: number; name: string }

export function useIdentity() {
  const [id, setId] = useState<number | null>(null)
  useEffect(() => {
    const v = localStorage.getItem('memberId')
    if (v) setId(Number(v))
  }, [])
  const pick = (memberId: number) => {
    localStorage.setItem('memberId', String(memberId))
    setId(memberId)
  }
  return { id, pick }
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
