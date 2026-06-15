'use client'

type Props = {
  dates: string[]                       // rolling window, YYYY-MM-DD
  counts: Record<string, number>        // date -> available count
  sessionDates: Set<string>
  myDates: Set<string>                  // dates the current member is available
  onToggle: (date: string) => void
  onOpen: (date: string) => void
}

function heat(count: number): string {
  if (count >= 4) return 'bg-orange-500 text-white'
  if (count === 3) return 'bg-orange-300'
  if (count === 2) return 'bg-orange-100'
  if (count === 1) return 'bg-orange-50'
  return 'bg-white'
}

export function Calendar({ dates, counts, sessionDates, myDates, onToggle, onOpen }: Props) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {dates.map((d) => {
        const count = counts[d] ?? 0
        const isSession = sessionDates.has(d)
        const mine = myDates.has(d)
        const day = Number(d.slice(8, 10))
        return (
          <div key={d} className={`relative rounded-lg border p-2 text-center text-sm ${heat(count)} ${isSession ? 'ring-2 ring-green-500' : ''}`}>
            <div className="text-[11px] text-gray-500">{d.slice(5)}</div>
            <button onClick={() => onToggle(d)} className={`mt-1 block w-full rounded ${mine ? 'font-bold underline' : ''}`}>
              {count > 0 ? `${count}명` : '·'}
            </button>
            {count >= 4 && (
              <button onClick={() => onOpen(d)} className="mt-1 text-[11px] text-blue-600 underline">
                시간표
              </button>
            )}
            {isSession && <span className="absolute right-1 top-1 text-green-600">✓</span>}
          </div>
        )
      })}
    </div>
  )
}
