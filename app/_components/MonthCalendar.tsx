'use client'
import { useMemo, useRef, useState, useTransition } from 'react'
import type { MonthAnchor } from '@/lib/calendar'
import { monthGrid } from '@/lib/calendar'
import { SNAP_MS, SNAP_EASE, settleIndex } from '@/lib/swipe'

type Member = { id: number; name: string }

type Props = {
  anchors: MonthAnchor[]
  today: string
  availByDate: Record<string, number[]> // date -> available memberIds
  members: Member[]
  colorMap: Record<number, string>
  sessionDates: Set<string>
  myId: number
  // Apply a batch of pending changes (one round-trip). adds/removes are date strings.
  onApply: (adds: string[], removes: string[]) => Promise<void>
  onOpenTimetable: (date: string) => void
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const MAX_BANDS = 3
type Diff = 'add' | 'remove'

// Gesture tuning
const LONG_MS = 400 // hold this long on a date to enter range-select mode
const MOVE_CANCEL = 12 // px of movement that turns a press into a month swipe

const pad2 = (n: number) => String(n).padStart(2, '0')

type Gesture = {
  x0: number
  y0: number
  startDate: string | null // selectable (non-past, active-month) date under the press
  kind: 'idle' | 'select' | 'swipe'
  mode: Diff // paint mode while selecting
  base: Map<string, Diff> // pending snapshot taken when select mode began
  longTimer: ReturnType<typeof setTimeout> | null
  lastX: number
  lastT: number
  vx: number // px/ms, for flick detection
}

export function MonthCalendar({
  anchors, today, availByDate, members, colorMap, sessionDates, myId, onApply, onOpenTimetable,
}: Props) {
  const [monthIdx, setMonthIdx] = useState(0)
  const [pending, setPending] = useState<Map<string, Diff>>(new Map())
  const [isSaving, startSave] = useTransition()
  const [swipeDx, setSwipeDx] = useState(0) // live month-swipe offset (px)
  const [animating, setAnimating] = useState(false)

  const g = useRef<Gesture | null>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const nameById = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members])

  const active = anchors[monthIdx]
  const activePrefix = `${active.year}-${pad2(active.month0 + 1)}` // YYYY-MM of the visible month
  const selectableDates = monthGrid(active.year, active.month0).filter((d): d is string => !!d && d >= today)

  const savedMine = (d: string) => (availByDate[d] ?? []).includes(myId)
  const effectiveMine = (d: string) => {
    const p = pending.get(d)
    if (p === 'add') return true
    if (p === 'remove') return false
    return savedMine(d)
  }

  const applyMode = (map: Map<string, Diff>, d: string, mode: Diff) => {
    const saved = savedMine(d)
    if (mode === 'add') {
      if (saved) map.delete(d) // already available → no diff to record
      else map.set(d, 'add')
    } else {
      if (saved) map.set(d, 'remove')
      else map.delete(d) // already unavailable → no diff to record
    }
  }

  // Paint the contiguous range anchor..cursor over a snapshot, so dragging back
  // un-paints dates that left the range.
  const paintRange = (base: Map<string, Diff>, a: string, b: string, mode: Diff) => {
    const lo = a < b ? a : b
    const hi = a < b ? b : a
    const next = new Map(base)
    for (const d of selectableDates) if (d >= lo && d <= hi) applyMode(next, d, mode)
    setPending(next)
  }

  const dateAt = (x: number, y: number): string | null =>
    document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-date]')?.dataset.date ?? null

  const goMonth = (i: number) => {
    setAnimating(true)
    setSwipeDx(0)
    setMonthIdx(Math.max(0, Math.min(anchors.length - 1, i)))
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (isSaving) return
    if ((e.target as HTMLElement).closest('button')) return // ‹ ›, 시간표 → handle themselves
    setAnimating(false)
    const d = dateAt(e.clientX, e.clientY)
    const startDate = d && d >= today && d.startsWith(activePrefix) ? d : null
    surfaceRef.current?.setPointerCapture(e.pointerId)
    const gesture: Gesture = {
      x0: e.clientX, y0: e.clientY, startDate, kind: 'idle', mode: 'add',
      base: new Map(pending), longTimer: null, lastX: e.clientX, lastT: performance.now(), vx: 0,
    }
    g.current = gesture
    if (startDate) {
      gesture.longTimer = setTimeout(() => {
        if (g.current !== gesture || gesture.kind !== 'idle') return
        gesture.kind = 'select'
        gesture.mode = effectiveMine(startDate) ? 'remove' : 'add'
        gesture.base = new Map(pending)
        paintRange(gesture.base, startDate, startDate, gesture.mode)
        navigator.vibrate?.(12)
      }, LONG_MS)
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const s = g.current
    if (!s) return
    const mx = e.clientX - s.x0
    const my = e.clientY - s.y0
    if (s.kind === 'select') {
      const d = dateAt(e.clientX, e.clientY)
      if (d && d >= today && d.startsWith(activePrefix)) paintRange(s.base, s.startDate!, d, s.mode)
      return
    }
    if (s.kind === 'idle') {
      if (Math.hypot(mx, my) <= MOVE_CANCEL) return
      if (s.longTimer) { clearTimeout(s.longTimer); s.longTimer = null }
      s.kind = 'swipe'
    }
    // swipe: sample velocity, follow the finger with resistance at the ends
    const now = performance.now()
    const dt = now - s.lastT
    if (dt > 0) s.vx = (e.clientX - s.lastX) / dt
    s.lastX = e.clientX
    s.lastT = now
    const atEnd = (monthIdx === 0 && mx > 0) || (monthIdx === anchors.length - 1 && mx < 0)
    setSwipeDx(atEnd ? mx * 0.35 : mx)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const s = g.current
    g.current = null
    if (!s) return
    if (s.longTimer) clearTimeout(s.longTimer)
    if (s.kind === 'swipe') {
      const w = surfaceRef.current?.clientWidth ?? 1
      setAnimating(true)
      setSwipeDx(0)
      setMonthIdx(settleIndex(monthIdx, anchors.length, e.clientX - s.x0, s.vx, w))
    } else if (s.kind === 'idle' && s.startDate) {
      const next = new Map(pending) // tap → toggle single
      applyMode(next, s.startDate, effectiveMine(s.startDate) ? 'remove' : 'add')
      setPending(next)
    }
  }

  const onPointerCancel = () => {
    const s = g.current
    g.current = null
    if (s?.longTimer) clearTimeout(s.longTimer)
    setAnimating(true)
    setSwipeDx(0)
  }

  // Keyboard fallback: Space/Enter toggles a single focused cell.
  const toggleSingle = (d: string) => {
    if (isSaving) return
    const next = new Map(pending)
    applyMode(next, d, effectiveMine(d) ? 'remove' : 'add')
    setPending(next)
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

  const renderCell = (d: string | null, idx: number) => {
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
        onKeyDown={(e) => {
          if (!isPast && (e.key === ' ' || e.key === 'Enter')) {
            e.preventDefault()
            toggleSingle(d)
          }
        }}
        className={`group relative flex min-h-[58px] flex-col rounded-lg border p-1 transition sm:min-h-[88px] ${stateRing} ${
          hot && !isPast && !pState ? 'ring-1 ring-orange-300' : ''
        } ${isSession && !pState ? 'ring-2 ring-emerald-500' : ''} ${isPast ? 'cursor-default' : 'cursor-pointer'}`}
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
            onClick={() => onOpenTimetable(d)}
            className="mt-0.5 rounded bg-orange-500 py-0.5 text-center text-[9px] font-bold text-white transition hover:bg-orange-600 sm:text-[10px]"
          >
            시간표 →
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* month nav (fixed; the grid below is what swipes) */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => goMonth(monthIdx - 1)}
          disabled={monthIdx === 0}
          className="flex h-9 w-9 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 disabled:opacity-25"
          aria-label="이전 달"
        >
          ‹
        </button>
        <h2 className="text-lg font-bold tracking-tight sm:text-xl">{active.label}</h2>
        <button
          type="button"
          onClick={() => goMonth(monthIdx + 1)}
          disabled={monthIdx === anchors.length - 1}
          className="flex h-9 w-9 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 disabled:opacity-25"
          aria-label="다음 달"
        >
          ›
        </button>
      </div>

      {/* weekday header (fixed; shared across all months) */}
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

      {/* swipeable month track — adjacent months peek in as you drag.
          touch-action none so a touch drag swipes / paints instead of scrolling. */}
      <div
        ref={surfaceRef}
        className="min-h-0 flex-1 overflow-hidden"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          className="flex h-full select-none"
          style={{
            transform: `translateX(calc(${-monthIdx * 100}% + ${swipeDx}px))`,
            transition: animating ? `transform ${SNAP_MS}ms ${SNAP_EASE}` : 'none',
          }}
        >
          {anchors.map((a, i) => (
            <div key={a.label} className="w-full shrink-0" inert={i !== monthIdx}>
              <div className="grid h-full grid-cols-7 gap-1 sm:gap-1.5">
                {monthGrid(a.year, a.month0).map((d, idx) => renderCell(d, idx))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="pt-1.5 text-center text-[10px] text-stone-300">
        탭 = 선택 · 꾹 누르고 드래그 = 여러 날 · 좌우로 넘기면 달 이동
      </p>

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
