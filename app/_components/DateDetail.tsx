'use client'
import { useState } from 'react'
import { formatWindow } from '@/domain/time'
import { selfFirst } from '@/lib/members'

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
  colorMap: Record<number, string>
  inkMap: Record<number, string>
  onCommit: (window: { start: string | null; end: string | null }) => void
  onUncommit: () => void
  onAddTopic: (text: string) => void
}

// Display window: noon → midnight (the group meets in the evening).
const DAY_START = 12 * 60
const DAY_END = 24 * 60
const SPAN = DAY_END - DAY_START
const HOUR_TICKS = [12, 14, 16, 18, 20, 22, 24]

const toMin = (s: string | null, fallback: number) =>
  s ? Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5)) : fallback
const clamp = (n: number) => Math.max(DAY_START, Math.min(DAY_END, n))
const pct = (min: number) => ((clamp(min) - DAY_START) / SPAN) * 100

export function DateDetail({
  date, members, commits, topics, suggested, myId, colorMap, inkMap, onCommit, onUncommit, onAddTopic,
}: Props) {
  const [start, setStart] = useState('19:00')
  const [end, setEnd] = useState('')
  const [anytime, setAnytime] = useState(false)
  const [topic, setTopic] = useState('')
  const byMember = new Map(commits.map((c) => [c.memberId, c]))
  // My own column reads first (left-most); colours stay keyed by id, so the
  // palette is unaffected by this display reorder.
  const ordered = selfFirst(members, myId)
  const n = members.length
  const iCommitted = byMember.has(myId)

  const mmdd = `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`
  const bandTop = suggested ? pct(toMin(suggested.start, DAY_START)) : 0
  const bandBottom = suggested ? pct(toMin(suggested.end, DAY_END)) : 0

  return (
    <section className="rounded-2xl border border-hairline bg-white p-4 sm:p-5">
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-base font-semibold tracking-tight sm:text-lg">{mmdd} 시간표</h2>
        <span className="text-xs text-muted">{commits.length}명 참석</span>
      </header>

      {/* timetable: time axis + a column per member, overlap band across all */}
      <div className="flex gap-1.5">
        {/* time axis gutter */}
        <div className="w-8 shrink-0 sm:w-9">
          <div className="h-5" />
          <div className="relative h-56 sm:h-72">
            {HOUR_TICKS.map((h) => (
              <span
                key={h}
                className="absolute right-1 -translate-y-1/2 text-[10px] tabular-nums text-stone-400"
                style={{ top: `${pct(h * 60)}%` }}
              >
                {h}
              </span>
            ))}
          </div>
          <div className="h-4" />
        </div>

        {/* columns area */}
        <div className="min-w-0 flex-1">
          {/* member names */}
          <div className="flex h-5">
            {ordered.map((m) => (
              <div
                key={m.id}
                className="min-w-0 flex-1 truncate px-0.5 text-center text-[11px] font-semibold sm:text-xs"
                style={{ color: m.id === myId ? '#0066cc' : byMember.has(m.id) ? inkMap[m.id] : '#c7c7cc' }}
              >
                {m.name}
              </div>
            ))}
          </div>

          {/* chart */}
          <div className="relative h-56 overflow-hidden rounded-xl border border-hairline bg-[#fafafc] sm:h-72">
            {/* hour gridlines */}
            {HOUR_TICKS.map((h) => (
              <div
                key={h}
                className="absolute inset-x-0 border-t border-stone-200/70"
                style={{ top: `${pct(h * 60)}%` }}
              />
            ))}

            {/* column separators */}
            {ordered.slice(1).map((m, i) => (
              <div
                key={m.id}
                className="absolute inset-y-0 border-l border-stone-200/50"
                style={{ left: `${((i + 1) * 100) / n}%` }}
              />
            ))}

            {/* overlap band — the signature: when >=4 are free at once */}
            {suggested && bandBottom > bandTop && (
              <div
                className="pointer-events-none absolute inset-x-0 border-y-2 border-accent bg-accent/10"
                style={{ top: `${bandTop}%`, height: `${bandBottom - bandTop}%` }}
                aria-label={`다 같이 가능한 시간 ${suggested.start}~${suggested.end}`}
              />
            )}

            {/* per-member availability bars */}
            {ordered.map((m, i) => {
              const c = byMember.get(m.id)
              if (!c) return null
              const top = pct(toMin(c.timeStart, DAY_START))
              const bottom = pct(toMin(c.timeEnd, DAY_END))
              if (bottom <= top) return null
              const isMe = m.id === myId
              return (
                <div
                  key={m.id}
                  className="absolute px-1"
                  style={{ left: `${(i * 100) / n}%`, width: `${100 / n}%`, top: `${top}%`, height: `${bottom - top}%` }}
                >
                  <div
                    className="h-full w-full rounded-md"
                    style={{ backgroundColor: colorMap[m.id], opacity: isMe ? 1 : 0.88 }}
                  />
                </div>
              )
            })}
          </div>

          {/* per-member window labels */}
          <div className="mt-1 flex">
            {ordered.map((m) => {
              const c = byMember.get(m.id)
              return (
                <div
                  key={m.id}
                  className="min-w-0 flex-1 truncate px-0.5 text-center text-[9px] leading-tight text-stone-500 sm:text-[10px]"
                >
                  {c ? formatWindow({ start: c.timeStart, end: c.timeEnd }) : '–'}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {suggested ? (
        <p className="mt-4 rounded-lg bg-accent-soft px-3 py-2 text-sm font-medium text-[#0a4f9e]">
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-accent align-middle" />
          다 같이 되는 시간 <span className="font-semibold">{suggested.start}~{suggested.end}</span> — 이때 어때요?
        </p>
      ) : (
        commits.length > 0 && (
          <p className="mt-4 rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-500">
            아직 4명이 겹치는 시간대가 없어요. 가능 시간을 남겨주세요.
          </p>
        )
      )}

      {/* commit form */}
      <div className="mt-4 space-y-3 border-t border-stone-200 pt-4">
        <p className="text-sm font-medium text-stone-700">내 가능 시간</p>
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-stone-600">
          <input
            type="checkbox"
            checked={anytime}
            onChange={(e) => setAnytime(e.target.checked)}
            className="h-4 w-4 accent-[#0066cc]"
          />
          시간무관 (아무 때나 OK)
        </label>
        {!anytime && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="rounded-lg border border-stone-300 px-2.5 py-1.5 tabular-nums focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <span className="text-stone-400">~</span>
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="rounded-lg border border-stone-300 px-2.5 py-1.5 tabular-nums focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <span className="text-xs text-stone-400">끝 시간 비우면 &ldquo;{start || '19:00'}~&rdquo;</span>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onCommit(anytime ? { start: null, end: null } : { start: start || null, end: end || null })}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:bg-accent-strong active:scale-[0.97]"
          >
            {iCommitted ? '시간 수정' : '하자 (참석)'}
          </button>
          {iCommitted && (
            <button
              type="button"
              onClick={onUncommit}
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50 active:scale-[0.97]"
            >
              참석 취소
            </button>
          )}
        </div>
      </div>

      {/* topics */}
      <div className="mt-4 border-t border-stone-200 pt-4">
        <p className="mb-2 text-sm font-medium text-stone-700">발표자 / 주제 <span className="font-normal text-stone-400">(선택)</span></p>
        {topics.length > 0 && (
          <ul className="mb-3 space-y-1">
            {topics.map((t, i) => {
              const name = members.find((m) => m.id === t.presenterId)?.name ?? '?'
              return (
                <li key={i} className="flex gap-2 text-sm text-stone-700">
                  <span className="font-medium text-stone-900">{name}</span>
                  <span className="text-stone-400">·</span>
                  <span>{t.text}</span>
                </li>
              )
            })}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && topic) {
                onAddTopic(topic)
                setTopic('')
              }
            }}
            placeholder="뭐 발표할지 (선택)"
            className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <button
            type="button"
            onClick={() => {
              if (topic) {
                onAddTopic(topic)
                setTopic('')
              }
            }}
            className="shrink-0 rounded-lg border border-stone-300 bg-white px-4 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
          >
            추가
          </button>
        </div>
      </div>
    </section>
  )
}
