'use client'
import { useState } from 'react'
import { formatWindow } from '@/domain/time'

type Member = { id: number; name: string }
type CommitRow = { memberId: number; timeStart: string | null; timeEnd: string | null }
type TopicRow = { presenterId: number; text: string }

type Props = {
  date: string
  members: Member[]
  commits: CommitRow[]
  topics: TopicRow[]
  suggested: { start: string; end: string } | null
  myId: number
  onCommit: (window: { start: string | null; end: string | null }) => void
  onUncommit: () => void
  onAddTopic: (text: string) => void
}

const HOURS = Array.from({ length: 13 }, (_, i) => 12 + i) // 12:00 .. 24:00

export function DateDetail({ date, members, commits, topics, suggested, myId, onCommit, onUncommit, onAddTopic }: Props) {
  const [start, setStart] = useState('19:00')
  const [end, setEnd] = useState('')
  const [anytime, setAnytime] = useState(false)
  const [topic, setTopic] = useState('')
  const byMember = new Map(commits.map((c) => [c.memberId, c]))

  return (
    <div className="rounded-xl border p-4">
      <h2 className="mb-3 text-lg font-semibold">{date} 시간표</h2>

      <div className="flex gap-2 overflow-x-auto">
        {members.map((m) => {
          const c = byMember.get(m.id)
          return (
            <div key={m.id} className="min-w-[64px] text-center">
              <div className="mb-1 text-xs font-medium">{m.name}</div>
              <div className="relative h-48 w-14 rounded bg-gray-50">
                {c && <Bar start={c.timeStart} end={c.timeEnd} suggested={suggested} />}
              </div>
              <div className="mt-1 text-[10px] text-gray-500">
                {c ? formatWindow({ start: c.timeStart, end: c.timeEnd }) : '-'}
              </div>
            </div>
          )
        })}
      </div>

      {suggested && (
        <p className="mt-3 text-sm text-orange-600">✨ 다 겹치는 시간: {suggested.start}~{suggested.end}</p>
      )}

      <div className="mt-4 space-y-2 border-t pt-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={anytime} onChange={(e) => setAnytime(e.target.checked)} /> 시간무관
        </label>
        {!anytime && (
          <div className="flex items-center gap-2 text-sm">
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="rounded border px-2 py-1" />
            ~
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded border px-2 py-1" placeholder="(이후)" />
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => onCommit(anytime ? { start: null, end: null } : { start: start || null, end: end || null })}
            className="rounded-lg bg-black px-4 py-1.5 text-sm text-white"
          >
            하자 (참석)
          </button>
          {byMember.has(myId) && (
            <button onClick={onUncommit} className="rounded-lg bg-gray-100 px-4 py-1.5 text-sm">참석 취소</button>
          )}
        </div>
      </div>

      <div className="mt-4 border-t pt-4">
        <div className="mb-1 text-sm font-medium">발표자/주제</div>
        <ul className="mb-2 text-sm text-gray-700">
          {topics.map((t, i) => {
            const name = members.find((m) => m.id === t.presenterId)?.name ?? '?'
            return <li key={i}>· {name}: {t.text}</li>
          })}
        </ul>
        <div className="flex gap-2">
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="뭐 할지 (선택)" className="flex-1 rounded border px-2 py-1 text-sm" />
          <button onClick={() => { if (topic) { onAddTopic(topic); setTopic('') } }} className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm">추가</button>
        </div>
      </div>
    </div>
  )
}

function Bar({ start, end, suggested }: { start: string | null; end: string | null; suggested: { start: string; end: string } | null }) {
  const dayStart = 12 * 60
  const dayEnd = 24 * 60
  const span = dayEnd - dayStart
  const toMin = (s: string | null, fallback: number) => (s ? Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5)) : fallback)
  const s = Math.max(toMin(start, dayStart), dayStart)
  const e = Math.min(toMin(end, dayEnd), dayEnd)
  const top = ((s - dayStart) / span) * 100
  const height = ((e - s) / span) * 100
  return <div className="absolute left-1 right-1 rounded bg-orange-400/70" style={{ top: `${top}%`, height: `${height}%` }} />
}
