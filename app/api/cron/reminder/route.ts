import { db } from '@/db/client'
import { sessions, commits, members, notifications } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { toKstDateString } from '@/lib/dates'
import { buildReminder } from '@/notify/messages'
import { postToDiscord } from '@/notify/discord'
import { computeSuggestedTime } from '@/domain/suggestedTime'
import { THRESHOLD } from '@/domain/thresholds'

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const today = toKstDateString(new Date())
  const todays = await db.select().from(sessions).where(eq(sessions.date, today))

  for (const s of todays) {
    const already = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.date, s.date), eq(notifications.eventType, 'reminder')))
    if (already.length > 0) continue

    await db.insert(notifications).values({ date: s.date, eventType: 'reminder' }).onConflictDoNothing()
    const comm = await db.select().from(commits).where(eq(commits.date, s.date))
    const all = await db.select().from(members)
    const byId = new Map(all.map((m) => [m.id, m]))
    const mentionIds = comm.map((c) => byId.get(c.memberId)?.discordId).filter(Boolean) as string[]
    const suggested = computeSuggestedTime(
      comm.map((c) => ({ start: c.timeStart, end: c.timeEnd })),
      THRESHOLD,
    )
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? ''
    await postToDiscord(buildReminder({ date: s.date, mentionIds, url: `${base}/?date=${s.date}`, suggested }))
  }

  return Response.json({ ok: true, reminded: todays.length })
}
