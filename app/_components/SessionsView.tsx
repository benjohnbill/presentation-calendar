type SessionRow = { date: string }

function fmt(date: string) {
  const dow = ['일', '월', '화', '수', '목', '금', '토'][new Date(date + 'T00:00:00Z').getUTCDay()]
  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일 (${dow})`
}

export function SessionsView({ upcoming, past }: { upcoming: SessionRow[]; past: SessionRow[] }) {
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
            <li
              key={s.date}
              className="flex items-center gap-3 rounded-2xl border border-[#cfe0f5] bg-accent-soft px-4 py-3"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm text-white">✓</span>
              <span className="font-semibold text-[#0a3f7e]">{fmt(s.date)}</span>
            </li>
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <>
          <h3 className="mb-2 mt-8 text-sm font-semibold text-stone-400">지난 세션</h3>
          <ul className="space-y-1">
            {past.map((s) => (
              <li key={s.date} className="rounded-lg px-3 py-2 text-sm text-stone-400">
                {fmt(s.date)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
