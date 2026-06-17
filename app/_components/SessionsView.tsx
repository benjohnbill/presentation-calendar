'use client'
import { useState } from 'react'
import { SessionRecordPanel } from './SessionRecordPanel'

type Member = { id: number; name: string; isAdmin: boolean }
type Topic = { presenterId: number; text: string }
type Material = { id: number; presenterId: number; url: string; label: string | null }
export type SessionRecord = {
  date: string
  finalTime: string | null
  topics: Topic[]
  materials: Material[]
}
type ProgramRow = { id: number; date: string; hostId: number; label: string; note: string | null }

function fmt(date: string) {
  const dow = ['일', '월', '화', '수', '목', '금', '토'][new Date(date + 'T00:00:00Z').getUTCDay()]
  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일 (${dow})`
}

export function SessionsView({
  upcoming, past, members, myId,
  onAddMaterial, onRemoveMaterial, onSetFinalTime, onCancelSession,
  upcomingPrograms, pastPrograms, onCreateProgram, onDeleteProgram,
}: {
  upcoming: SessionRecord[]
  past: SessionRecord[]
  members: Member[]
  myId: number
  onAddMaterial: (date: string, presenterId: number, url: string, label: string | null) => Promise<void>
  onRemoveMaterial: (id: number) => Promise<void>
  onSetFinalTime: (date: string, time: string | null) => Promise<void>
  onCancelSession: (date: string) => Promise<void>
  upcomingPrograms: ProgramRow[]
  pastPrograms: ProgramRow[]
  onCreateProgram: (date: string, label: string, note: string | null) => Promise<void>
  onDeleteProgram: (id: number) => Promise<void>
}) {
  const [openDate, setOpenDate] = useState<string | null>(null)
  const toggle = (d: string) => setOpenDate((cur) => (cur === d ? null : d))

  const [showForm, setShowForm] = useState(false)
  const [pDate, setPDate] = useState('')
  const [pLabel, setPLabel] = useState('')
  const [pNote, setPNote] = useState('')

  const programItem = (p: ProgramRow) => (
    <li key={`prog-${p.id}`} className="flex items-center gap-3 rounded-2xl border border-[#e6def5] bg-[#f6f2fc] px-4 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#8b5cf6] text-sm text-white">◆</span>
      <span className="font-semibold text-[#5b3aa6]">{fmt(p.date)} · {p.label}</span>
      <button type="button" onClick={() => onDeleteProgram(p.id)} className="ml-auto shrink-0 text-xs text-stone-400 hover:text-stone-600">삭제</button>
    </li>
  )

  // panel mounts only while its row is open, so its local form state (time/url/label) resets on close — intentional for v1
  const panel = (s: SessionRecord) => (
    <SessionRecordPanel
      date={s.date}
      finalTime={s.finalTime}
      topics={s.topics}
      materials={s.materials}
      members={members}
      isAdmin={members.find((m) => m.id === myId)?.isAdmin ?? false}
      onAddMaterial={onAddMaterial}
      onRemoveMaterial={onRemoveMaterial}
      onSetFinalTime={onSetFinalTime}
      onCancelSession={onCancelSession}
    />
  )

  return (
    <div className="mx-auto max-w-md">
      <h2 className="mb-4 text-lg font-bold tracking-tight sm:text-xl">다가오는 세션</h2>

      <div className="mb-3">
        {showForm ? (
          <div className="space-y-2 rounded-2xl border border-[#e6def5] bg-[#f6f2fc] p-3">
            <div className="flex flex-wrap gap-2">
              <input type="date" value={pDate} onChange={(e) => setPDate(e.target.value)}
                className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
              <input value={pLabel} onChange={(e) => setPLabel(e.target.value)} placeholder="보드게임 / 영화 …"
                className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
            <input value={pNote} onChange={(e) => setPNote(e.target.value)} placeholder="메모 (선택)"
              className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="rounded-full border border-stone-300 bg-white px-4 py-1.5 text-sm font-medium text-stone-600">닫기</button>
              <button type="button"
                onClick={() => {
                  if (pDate && pLabel) {
                    onCreateProgram(pDate, pLabel, pNote || null)
                    setPDate(''); setPLabel(''); setPNote(''); setShowForm(false)
                  }
                }}
                className="rounded-full bg-[#8b5cf6] px-5 py-1.5 text-sm font-semibold text-white transition active:scale-[0.97]">만들기</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setShowForm(true)}
            className="w-full rounded-2xl border border-dashed border-[#cdbef0] py-2.5 text-sm font-medium text-[#7c5bd6] transition hover:bg-[#f6f2fc]">
            + 프로그램
          </button>
        )}
      </div>

      {upcoming.length === 0 && upcomingPrograms.length === 0 ? (
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
          {upcomingPrograms.map(programItem)}
        </ul>
      )}

      {(past.length > 0 || pastPrograms.length > 0) && (
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
            {pastPrograms.map(programItem)}
          </ul>
        </>
      )}
    </div>
  )
}
