import { getMembers, getAvailabilityByDates, getSessionDates, getDateDetail } from '@/data/queries'
import { computeSuggestedTime } from '@/domain/suggestedTime'
import { monthAnchors, monthWindowDates, todayKst } from '@/lib/calendar'
import { AppShell } from './_components/AppShell'

const MONTHS = 3

export default async function Home({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams
  const today = new Date()
  const todayStr = todayKst(today)
  const anchors = monthAnchors(today, MONTHS)
  const windowDates = monthWindowDates(today, MONTHS)

  const [members, avail, sessionRows] = await Promise.all([
    getMembers(),
    getAvailabilityByDates(windowDates),
    getSessionDates(),
  ])

  const availByDate: Record<string, number[]> = {}
  for (const a of avail) (availByDate[a.date] ??= []).push(a.memberId)

  const detail = date ? await getDateDetail(date) : null
  const suggested = detail
    ? computeSuggestedTime(detail.comm.map((c) => ({ start: c.timeStart, end: c.timeEnd })), 4)
    : null

  const sessionDates = sessionRows.map((s) => s.date)
  const upcoming = sessionRows.filter((s) => s.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date))
  const past = sessionRows.filter((s) => s.date < todayStr).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <AppShell
      members={members}
      monthAnchors={anchors}
      today={todayStr}
      availByDate={availByDate}
      sessionDates={sessionDates}
      openDate={date ?? null}
      detail={detail}
      suggested={suggested}
      upcoming={upcoming}
      past={past}
    />
  )
}
