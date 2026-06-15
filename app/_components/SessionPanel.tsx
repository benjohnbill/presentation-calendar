type SessionRow = { date: string }
export function SessionPanel({ upcoming, past }: { upcoming: SessionRow[]; past: SessionRow[] }) {
  return (
    <aside className="space-y-4">
      <section>
        <h3 className="mb-2 text-sm font-semibold text-green-700">다가오는 세션</h3>
        {upcoming.length === 0 ? <p className="text-sm text-gray-400">아직 없음</p> : (
          <ul className="space-y-1 text-sm">{upcoming.map((s) => <li key={s.date}>✓ {s.date}</li>)}</ul>
        )}
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-500">지난 세션</h3>
        <ul className="space-y-1 text-sm text-gray-500">{past.map((s) => <li key={s.date}>{s.date}</li>)}</ul>
      </section>
    </aside>
  )
}
