import { getMembers, getAvailabilityByDates, getSessionDates, getDateDetail, getTopicsByDates, getMaterialsByDates, getPrograms } from '@/data/queries'
import { computeSuggestedTime } from '@/domain/suggestedTime'
import { THRESHOLD } from '@/domain/thresholds'
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

  // Timetable targets: upcoming days where THRESHOLD+ members are available.
  // Fetch every target's detail so the timetable can be a swipeable carousel.
  const targetDates = Object.keys(availByDate)
    .filter((d) => d >= todayStr && availByDate[d].length >= THRESHOLD)
    .sort()
  const timetableDays = await Promise.all(
    targetDates.map(async (d) => {
      const det = await getDateDetail(d)
      return {
        date: d,
        comm: det.comm,
        tops: det.tops,
        suggested: computeSuggestedTime(det.comm.map((c) => ({ start: c.timeStart, end: c.timeEnd })), THRESHOLD),
      }
    }),
  )

  const sessionDates = sessionRows.map((s) => s.date)
  const [allTopics, allMaterials, allPrograms] = await Promise.all([
    getTopicsByDates(sessionDates),
    getMaterialsByDates(sessionDates),
    getPrograms(),
  ])
  const toRecord = (s: (typeof sessionRows)[number]) => ({
    date: s.date,
    finalTime: s.finalTime,
    topics: allTopics.filter((t) => t.date === s.date).map((t) => ({ presenterId: t.presenterId, text: t.text })),
    materials: allMaterials
      .filter((m) => m.date === s.date)
      .map((m) => ({ id: m.id, presenterId: m.presenterId, url: m.url, label: m.label })),
  })
  const upcoming = sessionRows.filter((s) => s.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date)).map(toRecord)
  const past = sessionRows.filter((s) => s.date < todayStr).sort((a, b) => b.date.localeCompare(a.date)).map(toRecord)

  const programDates = allPrograms.map((p) => p.date)
  const upcomingPrograms = allPrograms.filter((p) => p.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date))
  const pastPrograms = allPrograms.filter((p) => p.date < todayStr).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <AppShell
      members={members}
      monthAnchors={anchors}
      today={todayStr}
      availByDate={availByDate}
      sessionDates={sessionDates}
      openDate={date ?? null}
      timetableDays={timetableDays}
      upcoming={upcoming}
      past={past}
      upcomingPrograms={upcomingPrograms}
      pastPrograms={pastPrograms}
      programDates={programDates}
    />
  )
}
