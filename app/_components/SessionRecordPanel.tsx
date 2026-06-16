'use client'
import { useState } from 'react'

type Member = { id: number; name: string }
type Topic = { presenterId: number; text: string }
type Material = { id: number; presenterId: number; url: string; label: string | null }

export function SessionRecordPanel({
  date, finalTime, topics, materials, members,
  onAddMaterial, onRemoveMaterial, onSetFinalTime,
}: {
  date: string
  finalTime: string | null
  topics: Topic[]
  materials: Material[]
  members: Member[]
  onAddMaterial: (date: string, presenterId: number, url: string, label: string | null) => Promise<void>
  onRemoveMaterial: (id: number) => Promise<void>
  onSetFinalTime: (date: string, time: string | null) => Promise<void>
}) {
  const nameById = new Map(members.map((m) => [m.id, m.name]))
  const [time, setTime] = useState(finalTime ? finalTime.slice(0, 5) : '')
  const [presenterId, setPresenterId] = useState<number>(members[0]?.id ?? 0)
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')

  return (
    <div className="mt-2 space-y-4 rounded-xl border border-hairline bg-white p-4">
      {/* final time (silent record — no notification) */}
      <div>
        <p className="mb-1.5 text-sm font-medium text-stone-700">최종 시간 <span className="font-normal text-stone-400">(카톡에서 정한 시각)</span></p>
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm tabular-nums focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <button
            type="button"
            onClick={() => onSetFinalTime(date, time || null)}
            className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-accent-strong active:scale-[0.97]"
          >
            저장
          </button>
        </div>
      </div>

      {/* topics (read-only) */}
      {topics.length > 0 && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-stone-700">발표 주제</p>
          <ul className="space-y-1">
            {topics.map((t, i) => (
              <li key={i} className="flex gap-2 text-sm text-stone-700">
                <span className="font-medium text-stone-900">{nameById.get(t.presenterId) ?? '?'}</span>
                <span className="text-stone-400">·</span>
                <span>{t.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* materials (per presenter) */}
      <div>
        <p className="mb-1.5 text-sm font-medium text-stone-700">발표 자료</p>
        {materials.length > 0 && (
          <ul className="mb-2 space-y-1">
            {materials.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-sm">
                <span className="font-medium text-stone-900">{nameById.get(m.presenterId) ?? '?'}</span>
                <a href={m.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-accent underline">
                  {m.label || m.url}
                </a>
                <button
                  type="button"
                  onClick={() => onRemoveMaterial(m.id)}
                  className="shrink-0 text-xs text-stone-400 hover:text-stone-600"
                  aria-label="자료 삭제"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={presenterId}
            onChange={(e) => setPresenterId(Number(e.target.value))}
            className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="자료 링크 (Drive 등)"
            className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="라벨 (선택)"
            className="w-28 rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <button
            type="button"
            onClick={() => {
              if (url) {
                onAddMaterial(date, presenterId, url, label || null)
                setUrl('')
                setLabel('')
              }
            }}
            className="shrink-0 rounded-lg border border-stone-300 bg-white px-4 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
          >
            추가
          </button>
        </div>
      </div>
    </div>
  )
}
