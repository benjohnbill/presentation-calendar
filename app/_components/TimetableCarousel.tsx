'use client'
import { useRef, useState } from 'react'
import { DateDetail } from './DateDetail'
import { ClockIcon } from './icons'

type Member = { id: number; name: string }
type CommitRow = { memberId: number; timeStart: string | null; timeEnd: string | null }
type TopicRow = { presenterId: number; text: string }
type Day = {
  date: string
  comm: CommitRow[]
  tops: TopicRow[]
  suggested: { start: string; end: string } | null
}

const SWIPE = 60 // px past which a horizontal drag flips to the next/prev day
const mmdd = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`

// A swipeable carousel over the days that qualify for a timetable (THRESHOLD+
// available). Opens on the nearest day; swipe / chevrons / dots move between them.
export function TimetableCarousel({
  days, members, myId, initialDate, onCommit, onUncommit, onAddTopic, onGoCalendar,
}: {
  days: Day[]
  members: Member[]
  myId: number
  initialDate: string | null
  onCommit: (date: string, window: { start: string | null; end: string | null }) => Promise<void>
  onUncommit: (date: string) => Promise<void>
  onAddTopic: (date: string, text: string) => Promise<void>
  onGoCalendar: () => void
}) {
  const start = initialDate ? days.findIndex((d) => d.date === initialDate) : 0
  const [idx, setIdx] = useState(start < 0 ? 0 : start)
  const [dx, setDx] = useState(0) // live horizontal drag offset
  const drag = useRef<{ x0: number; y0: number; active: boolean } | null>(null)
  const vpRef = useRef<HTMLDivElement>(null)

  if (days.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center text-sm text-stone-400">
        <ClockIcon className="mb-2 h-8 w-8 text-stone-300" />
        <p>아직 4명 이상 모인 날이 없어요.</p>
        <p className="mt-1">
          <button onClick={onGoCalendar} className="font-medium text-orange-600 underline">잠정결론 맞추기</button>
          에서 가능한 날을 모아보세요.
        </p>
      </div>
    )
  }

  const cur = Math.min(idx, days.length - 1) // clamp in case the day set shrank
  const go = (i: number) => setIdx(Math.max(0, Math.min(days.length - 1, i)))

  // Horizontal swipe only; touch-action: pan-y leaves vertical scrolling to the browser.
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('input,textarea,button,select,label,a')) return
    drag.current = { x0: e.clientX, y0: e.clientY, active: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const mx = e.clientX - d.x0
    const my = e.clientY - d.y0
    if (!d.active) {
      if (Math.abs(my) > 12 && Math.abs(my) > Math.abs(mx)) { drag.current = null; return } // vertical scroll wins
      if (Math.abs(mx) > 12) { d.active = true; vpRef.current?.setPointerCapture(e.pointerId) }
      else return
    }
    // rubber-band resistance at the ends
    const atEnd = (cur === 0 && mx > 0) || (cur === days.length - 1 && mx < 0)
    setDx(atEnd ? mx * 0.3 : mx)
  }
  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (d?.active) {
      if (dx < -SWIPE) go(cur + 1)
      else if (dx > SWIPE) go(cur - 1)
    }
    setDx(0)
  }

  return (
    <div className="flex h-full flex-col">
      {/* header + position */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => go(cur - 1)}
          disabled={cur === 0}
          className="flex h-9 w-9 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 disabled:opacity-25"
          aria-label="이전 날"
        >
          ‹
        </button>
        <div className="text-center">
          <h2 className="text-base font-bold tracking-tight sm:text-lg">{mmdd(days[cur].date)} 시간표</h2>
          <p className="text-[11px] text-stone-400">
            {cur === 0 ? '가장 가까운 날' : `${cur + 1}번째 대상일`} · {cur + 1}/{days.length}
          </p>
        </div>
        <button
          type="button"
          onClick={() => go(cur + 1)}
          disabled={cur === days.length - 1}
          className="flex h-9 w-9 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 disabled:opacity-25"
          aria-label="다음 날"
        >
          ›
        </button>
      </div>

      {/* viewport */}
      <div
        ref={vpRef}
        className="overflow-hidden"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="flex items-start"
          style={{
            transform: `translateX(calc(${-cur * 100}% + ${dx}px))`,
            transition: dx === 0 ? 'transform .2s ease' : 'none',
          }}
        >
          {days.map((day) => (
            <div key={day.date} className="w-full shrink-0 px-0.5">
              <DateDetail
                date={day.date}
                members={members}
                commits={day.comm}
                topics={day.tops}
                suggested={day.suggested}
                myId={myId}
                onCommit={(w) => onCommit(day.date, w)}
                onUncommit={() => onUncommit(day.date)}
                onAddTopic={(t) => onAddTopic(day.date, t)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* dots */}
      {days.length > 1 && (
        <>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {days.map((day, i) => (
              <button
                key={day.date}
                type="button"
                onClick={() => go(i)}
                aria-label={`${mmdd(day.date)}로 이동`}
                className={`h-1.5 rounded-full transition-all ${i === cur ? 'w-4 bg-orange-500' : 'w-1.5 bg-stone-300'}`}
              />
            ))}
          </div>
          <p className="mt-2 text-center text-[11px] text-stone-300">좌우로 스와이프해서 다른 날 보기</p>
        </>
      )}
    </div>
  )
}
