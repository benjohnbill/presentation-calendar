import { getMembers, getAvailabilityByDates, getSessionDates, getDateDetail } from '@/data/queries'
import { rollingWindowDates, toKstDateString } from '@/lib/dates'
import { computeSuggestedTime } from '@/domain/suggestedTime'
import { CalendarClient } from './_components/CalendarClient'
import { SessionPanel } from './_components/SessionPanel'

export default async function Home({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams
  const today = new Date()
  const todayStr = toKstDateString(today)
  const dates = rollingWindowDates(today, 8)

  const [members, avail, sessionRows] = await Promise.all([
    getMembers(),
    getAvailabilityByDates(dates),
    getSessionDates(),
  ])

  const counts: Record<string, number> = {}
  for (const a of avail) counts[a.date] = (counts[a.date] ?? 0) + 1

  const detail = date ? await getDateDetail(date) : null
  const suggested = detail ? computeSuggestedTime(detail.comm.map((c) => ({ start: c.timeStart, end: c.timeEnd })), 4) : null

  const sessionDates = sessionRows.map((s) => s.date)
  const upcoming = sessionRows.filter((s) => s.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date))
  const past = sessionRows.filter((s) => s.date < todayStr).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">발표 캘린더</h1>
      <div className="grid grid-cols-[1fr_220px] gap-6">
        <CalendarClient
          members={members}
          dates={dates}
          counts={counts}
          sessionDates={sessionDates}
          availability={avail}
          openDate={date ?? null}
          detail={detail}
          suggested={suggested}
        />
        <SessionPanel upcoming={upcoming} past={past} />
      </div>
    </main>
  )
}
