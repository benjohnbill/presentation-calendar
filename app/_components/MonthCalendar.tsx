'use client'
import { useMemo, useRef, useState, useTransition } from 'react'
import type { MonthAnchor } from '@/lib/calendar'
import { monthGrid } from '@/lib/calendar'

type Member = { id: number; name: string }

type Props = {
  anchor: MonthAnchor
  today: string
  availByDate: Record<string, number[]> // date -> available memberIds
  members: Member[]
  colorMap: Record<number, string>
  sessionDates: Set<string>
  myId: number
  // Apply a batch of pending changes (one round-trip). adds/removes are date strings.
  onApply: (adds: string[], removes: string[]) => Promise<void>
  onOpenTimetable: (date: string) => void
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const MAX_BANDS = 3
type Diff = 'add' | 'remove'

export function MonthCalendar({
  anchor, today, availByDate, members, colorMap, sessionDates,
  myId, onApply, onOpenTimetable, canPrev, canNext, onPrev, onNext,
}: Props) {
  const cells = monthGrid(anchor.year, anchor.month0)
  const nameById = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members])

  // Pending diff against the saved state. Empty = nothing to confirm.
  const [pending, setPending] = useState<Map<string, Diff>>(new Map())
  const [isSaving, startSave] = useTransition()

  // Drag-paint: the mode is decided once on pointer-down (toggle of the anchor
  // cell) and then painted onto every cell the pointer crosses.
  const dragMode = useRef<Diff | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const savedMine = (d: string) => (availByDate[d] ?? []).includes(myId)
  const effectiveMine = (d: string) => {
    const p = pending.get(d)
    if (p === 'add') return true
    if (p === 'remove') return false
    return savedMine(d)
  }

  // Apply the active drag mode to one date, collapsing no-op diffs back to empty.
  const paint = (d: string) => {
    const mode = dragMode.current
    if (!mode) return
    setPending((prev) => {
      const next = new Map(prev)
      const saved = savedMine(d)
      if (mode === 'add') {
        if (saved) next.delete(d) // already available → no change to record
        else next.set(d, 'add')
      } else {
        if (saved) next.set(d, 'remove')
        else next.delete(d) // already unavailable → no change to record
      }
      return next
    })
  }

  const beginDrag = (d: string) => {
    dragMode.current = effectiveMine(d) ? 'remove' : 'add'
    paint(d)
  }

  const dateAt = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y)
    const cell = el?.closest<HTMLElement>('[data-date]')
    return cell?.dataset.date ?? null
  }

  const onPointerDown = (e: React.PointerEvent, d: string, isPast: boolean) => {
    if (isPast || isSaving) return
    e.preventDefault()
    // Capture on the grid so move/up keep flowing even off the original cell.
    gridRef.current?.setPointerCapture(e.pointerId)
    beginDrag(d)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragMode.current) return
    const d = dateAt(e.clientX, e.clientY)
    if (d && d >= today) paint(d) // skip past dates
  }

  const endDrag = () => {
    dragMode.current = null
  }

  // Keyboard fallback: Space/Enter toggles a single focused cell.
  const toggleSingle = (d: string) => {
    if (isSaving) return
    dragMode.current = effectiveMine(d) ? 'remove' : 'add'
    paint(d)
    dragMode.current = null
  }

  const adds = useMemo(() => [...pending].filter(([, v]) => v === 'add').map(([d]) => d), [pending])
  const removes = useMemo(() => [...pending].filter(([, v]) => v === 'remove').map(([d]) => d), [pending])

  const confirm = () => {
    startSave(async () => {
      try {
        await onApply(adds, removes)
        setPending(new Map()) // saved state now reflects the change
      } catch {
        // keep the pending selection so the user can retry
      }
    })
  }
  const cancel = () => setPending(new Map())

  return (
    <div className="flex h-full flex-col">
      {/* month nav */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          className="flex h-9 w-9 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 disabled:opacity-25"
          aria-label="이전 달"
        >
          ‹
        </button>
        <h2 className="text-lg font-bold tracking-tight sm:text-xl">{anchor.label}</h2>
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          className="flex h-9 w-9 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 disabled:opacity-25"
          aria-label="다음 달"
        >
          ›
        </button>
      </div>

      {/* weekday header */}
      <div className="mb-1 grid grid-cols-7">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`pb-1 text-center text-[11px] font-medium sm:text-xs ${
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-stone-400'
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* grid — pointer events drive drag-paint; touch-action none so a touch
          drag paints instead of scrolling the page */}
      <div
        ref={gridRef}
        className="grid flex-1 select-none grid-cols-7 gap-1 sm:gap-1.5"
        style={{ touchAction: 'none' }}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {cells.map((d, idx) => {
          if (!d) return <div key={`b-${idx}`} aria-hidden />
          const ids = availByDate[d] ?? []
          const isPast = d < today
          const isToday = d === today
          const isSession = sessionDates.has(d)
          const pState = pending.get(d)
          const showMine = effectiveMine(d)
          const count = ids.length
          const hot = count >= 4
          const dow = new Date(d + 'T00:00:00Z').getUTCDay()
          const dayNum = Number(d.slice(8, 10))
          // my band first, then others
          const others = ids.filter((id) => id !== myId)
          const ordered = showMine ? [myId, ...others] : others
          const shown = ordered.slice(0, MAX_BANDS)
          const overflow = ordered.length - shown.length

          const stateRing = pState === 'add'
            ? 'border-orange-400 bg-orange-50 ring-1 ring-orange-300'
            : pState === 'remove'
              ? 'border-rose-300 bg-rose-50 ring-1 ring-rose-200'
              : isPast
                ? 'border-stone-100 bg-stone-50/40'
                : 'border-stone-200 bg-white'

          return (
            <div
              key={d}
              data-date={d}
              role="button"
              tabIndex={isPast ? -1 : 0}
              aria-pressed={showMine}
              aria-label={`${dayNum}일 ${showMine ? '가능' : '가능 안 함'}`}
              onPointerDown={(e) => onPointerDown(e, d, isPast)}
              onKeyDown={(e) => {
                if (!isPast && (e.key === ' ' || e.key === 'Enter')) {
                  e.preventDefault()
                  toggleSingle(d)
                }
              }}
              className={`group relative flex min-h-[58px] flex-col rounded-lg border p-1 transition sm:min-h-[88px] ${stateRing} ${
                hot && !isPast && !pState ? 'ring-1 ring-orange-300' : ''
              } ${isSession && !pState ? 'ring-2 ring-emerald-500' : ''} ${
                isPast ? 'cursor-default' : 'cursor-pointer'
              }`}
            >
              <div className="mb-0.5 flex items-center justify-between">
                <span
                  className={`text-[11px] font-semibold leading-none sm:text-xs ${
                    isPast ? 'text-stone-300'
                      : dow === 0 ? 'text-red-400'
                      : dow === 6 ? 'text-blue-400'
                      : 'text-stone-600'
                  } ${isToday ? 'flex h-5 w-5 items-center justify-center rounded-full bg-stone-900 text-white' : ''}`}
                >
                  {dayNum}
                </span>
                {pState === 'add' ? (
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold leading-none text-white">+</span>
                ) : pState === 'remove' ? (
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold leading-none text-white">−</span>
                ) : isSession ? (
                  <span className="text-[10px] text-emerald-500">✓</span>
                ) : null}
              </div>

              {/* availability bands */}
              <div className="flex flex-1 flex-col gap-0.5">
                {shown.map((id) => {
                  const isMe = id === myId
                  const meAdding = isMe && pState === 'add'
                  const meRemoving = isMe && pState === 'remove'
                  return (
                    <span
                      key={id}
                      className={`flex items-center gap-0.5 truncate rounded-[3px] px-1 text-[9px] font-medium leading-[14px] text-white sm:text-[10px] sm:leading-4 ${
                        meAdding ? 'opacity-80 ring-1 ring-white/70' : ''
                      } ${meRemoving ? 'opacity-50 line-through' : ''}`}
                      style={{ backgroundColor: colorMap[id] }}
                    >
                      {isMe && <span className="text-[8px]">✓</span>}
                      <span className="truncate">{nameById.get(id) ?? '?'}</span>
                    </span>
                  )
                })}
                {overflow > 0 && (
                  <span className="px-1 text-[9px] font-medium text-stone-400 sm:text-[10px]">+{overflow}</span>
                )}
              </div>

              {hot && !isPast && (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onOpenTimetable(d)}
                  className="mt-0.5 rounded bg-orange-500 py-0.5 text-center text-[9px] font-bold text-white transition hover:bg-orange-600 sm:text-[10px]"
                >
                  시간표 →
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* confirm bar — appears only when there is a pending selection */}
      {pending.size > 0 && (
        <div className="sticky bottom-0 z-10 mt-2 flex items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white/95 p-2.5 shadow-lg backdrop-blur">
          <p className="min-w-0 truncate text-sm text-stone-700">
            <span className="font-semibold text-stone-900">
              {adds.length > 0 && `${adds.length}일 추가`}
              {adds.length > 0 && removes.length > 0 && ' · '}
              {removes.length > 0 && `${removes.length}일 해제`}
            </span>{' '}
            <span className="text-stone-400">— 맞으면 확인</span>
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={cancel}
              disabled={isSaving}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={isSaving}
              className="rounded-lg bg-orange-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 active:scale-[0.98] disabled:opacity-60"
            >
              {isSaving ? '저장 중…' : '확인'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
