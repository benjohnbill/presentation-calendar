'use client'
import { useState } from 'react'
import { SessionRecordPanel } from './SessionRecordPanel'

type Member = { id: number; name: string }
type Topic = { presenterId: number; text: string }
type Material = { id: number; presenterId: number; url: string; label: string | null }
export type SessionRecord = {
  date: string
  finalTime: string | null
  topics: Topic[]
  materials: Material[]
}

function fmt(date: string) {
  const dow = ['일', '월', '화', '수', '목', '금', '토'][new Date(date + 'T00:00:00Z').getUTCDay()]
  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일 (${dow})`
}

export function SessionsView({
  upcoming, past, members,
  onAddMaterial, onRemoveMaterial, onSetFinalTime,
}: {
  upcoming: SessionRecord[]
  past: SessionRecord[]
  members: Member[]
  onAddMaterial: (date: string, presenterId: number, url: string, label: string | null) => Promise<void>
  onRemoveMaterial: (id: number) => Promise<void>
  onSetFinalTime: (date: string, time: string | null) => Promise<void>
}) {
  const [openDate, setOpenDate] = useState<string | null>(null)
  const toggle = (d: string) => setOpenDate((cur) => (cur === d ? null : d))

  const panel = (s: SessionRecord) => (
    <SessionRecordPanel
      date={s.date}
      finalTime={s.finalTime}
      topics={s.topics}
      materials={s.materials}
      members={members}
      onAddMaterial={onAddMaterial}
      onRemoveMaterial={onRemoveMaterial}
      onSetFinalTime={onSetFinalTime}
    />
  )

  return (
    <div className="mx-auto max-w-md">
      <h2 className="mb-4 text-lg font-bold tracking-tight sm:text-xl">다가오는 세션</h2>

      {upcoming.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 px-4 py-10 text-center text-sm text-stone-400">
          아직 잡힌 세션이 없어요.<br />4명이 &ldquo;하자&rdquo;하면 여기 떠요.
        </div>
      ) : (
        <ul className="space-y-2">
          {upcoming.map((s) => (
            <li key={s.date}>
              <button
                type="button"
                onClick={() => toggle(s.date)}
                className="flex w-full items-center gap-3 rounded-2xl border border-[#cfe0f5] bg-accent-soft px-4 py-3 text-left transition active:scale-[0.99]"
                aria-expanded={openDate === s.date}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm text-white">✓</span>
                <span className="font-semibold text-[#0a3f7e]">{fmt(s.date)}</span>
                {s.finalTime && <span className="ml-auto text-sm font-medium text-[#0a4f9e] tabular-nums">{s.finalTime.slice(0, 5)}</span>}
              </button>
              {openDate === s.date && panel(s)}
            </li>
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <>
          <h3 className="mb-2 mt-8 text-sm font-semibold text-stone-400">지난 세션</h3>
          <ul className="space-y-1">
            {past.map((s) => (
              <li key={s.date}>
                <button
                  type="button"
                  onClick={() => toggle(s.date)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-stone-500 transition hover:bg-stone-50"
                  aria-expanded={openDate === s.date}
                >
                  <span>{fmt(s.date)}</span>
                  {s.materials.length > 0 && <span className="text-xs text-stone-400">· 자료 {s.materials.length}</span>}
                </button>
                {openDate === s.date && panel(s)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
