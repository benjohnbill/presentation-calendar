'use client'
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
  onToggle: (date: string) => void
  onOpenTimetable: (date: string) => void
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const MAX_BANDS = 3

export function MonthCalendar({
  anchor, today, availByDate, members, colorMap, sessionDates,
  myId, onToggle, onOpenTimetable, canPrev, canNext, onPrev, onNext,
}: Props) {
  const cells = monthGrid(anchor.year, anchor.month0)
  const nameById = new Map(members.map((m) => [m.id, m.name]))

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

      {/* grid */}
      <div className="grid flex-1 grid-cols-7 gap-1 sm:gap-1.5">
        {cells.map((d, idx) => {
          if (!d) return <div key={`b-${idx}`} aria-hidden />
          const ids = availByDate[d] ?? []
          const count = ids.length
          const isPast = d < today
          const isToday = d === today
          const isSession = sessionDates.has(d)
          const mine = ids.includes(myId)
          const hot = count >= 4
          const dow = new Date(d + 'T00:00:00Z').getUTCDay()
          const dayNum = Number(d.slice(8, 10))
          // show my band first, then others
          const ordered = [...ids].sort((a, b) => (a === myId ? -1 : b === myId ? 1 : 0))
          const shown = ordered.slice(0, MAX_BANDS)
          const overflow = count - shown.length

          return (
            <div
              key={d}
              className={`group relative flex min-h-[58px] flex-col rounded-lg border p-1 transition sm:min-h-[88px] ${
                isPast ? 'border-stone-100 bg-stone-50/40' : 'border-stone-200 bg-white'
              } ${hot && !isPast ? 'ring-1 ring-orange-300' : ''} ${
                isSession ? 'ring-2 ring-emerald-500' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => !isPast && onToggle(d)}
                disabled={isPast}
                aria-pressed={mine}
                className="flex flex-1 flex-col items-stretch text-left disabled:cursor-default"
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
                  {isSession && <span className="text-[10px] text-emerald-500">✓</span>}
                </div>

                {/* availability bands */}
                <div className="flex flex-1 flex-col gap-0.5">
                  {shown.map((id) => (
                    <span
                      key={id}
                      className="flex items-center gap-0.5 truncate rounded-[3px] px-1 text-[9px] font-medium leading-[14px] text-white sm:text-[10px] sm:leading-4"
                      style={{ backgroundColor: colorMap[id] }}
                    >
                      {id === myId && <span className="text-[8px]">✓</span>}
                      <span className="truncate">{nameById.get(id) ?? '?'}</span>
                    </span>
                  ))}
                  {overflow > 0 && (
                    <span className="px-1 text-[9px] font-medium text-stone-400 sm:text-[10px]">+{overflow}</span>
                  )}
                </div>
              </button>

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
        })}
      </div>
    </div>
  )
}
