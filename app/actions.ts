'use server'

import { db } from '@/db/client'
import { availabilities, commits, sessions, notifications, members, topics } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { shouldFireProvisional, shouldCreateSession } from '@/domain/thresholds'
import { computeSuggestedTime } from '@/domain/suggestedTime'
import { formatWindow } from '@/domain/time'
import { buildProvisional, buildSessionCreated } from '@/notify/messages'
import { postToDiscord } from '@/notify/discord'

function dateUrl(date: string) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  return `${base}/?date=${date}`
}

export async function markAvailable(memberId: number, date: string) {
  await db.insert(availabilities).values({ memberId, date }).onConflictDoNothing()

  const avail = await db.select().from(availabilities).where(eq(availabilities.date, date))
  const sess = await db.select().from(sessions).where(eq(sessions.date, date))
  const notified = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.date, date), eq(notifications.eventType, 'provisional')))

  if (
    shouldFireProvisional({
      availableCount: avail.length,
      sessionExists: sess.length > 0,
      alreadyNotified: notified.length > 0,
    })
  ) {
    // record first (unique constraint guards against double-send under races)
    await db.insert(notifications).values({ date, eventType: 'provisional' }).onConflictDoNothing()
    const all = await db.select().from(members)
    const availableIds = new Set(avail.map((a) => a.memberId))
    const mentionIds = all.filter((m) => availableIds.has(m.id)).map((m) => m.discordId)
    await postToDiscord(buildProvisional({ date, mentionIds, url: dateUrl(date) }))
  }

  revalidatePath('/')
}

export async function unmarkAvailable(memberId: number, date: string) {
  // cascade: removing availability also removes any commit (Commit ⊆ Available)
  await db.delete(commits).where(and(eq(commits.memberId, memberId), eq(commits.date, date)))
  await db.delete(availabilities).where(and(eq(availabilities.memberId, memberId), eq(availabilities.date, date)))
  // provisional may silently break — no notification (by design)
  revalidatePath('/')
}

export async function commit(
  memberId: number,
  date: string,
  window: { start: string | null; end: string | null },
) {
  // Commit ⊆ Available: ensure availability exists
  await db.insert(availabilities).values({ memberId, date }).onConflictDoNothing()
  await db
    .insert(commits)
    .values({ memberId, date, timeStart: window.start, timeEnd: window.end })
    .onConflictDoUpdate({
      target: [commits.memberId, commits.date],
      set: { timeStart: window.start, timeEnd: window.end },
    })

  const comm = await db.select().from(commits).where(eq(commits.date, date))
  const sess = await db.select().from(sessions).where(eq(sessions.date, date))

  if (shouldCreateSession({ commitCount: comm.length, sessionExists: sess.length > 0 })) {
    await db.insert(sessions).values({ date }).onConflictDoNothing()
    await db.insert(notifications).values({ date, eventType: 'session_created' }).onConflictDoNothing()

    const all = await db.select().from(members)
    const byId = new Map(all.map((m) => [m.id, m]))
    const windows = comm.map((c) => ({ start: c.timeStart, end: c.timeEnd }))
    const lines = comm.map((c) => `${byId.get(c.memberId)?.name ?? '?'}  ${formatWindow({ start: c.timeStart, end: c.timeEnd })}`)
    const suggested = computeSuggestedTime(windows, 4)
    const mentionIds = comm.map((c) => byId.get(c.memberId)?.discordId).filter(Boolean) as string[]
    await postToDiscord(buildSessionCreated({ date, lines, suggested, mentionIds, url: dateUrl(date) }))
  }

  revalidatePath('/')
}

export async function uncommit(memberId: number, date: string) {
  await db.delete(commits).where(and(eq(commits.memberId, memberId), eq(commits.date, date)))
  // session is sticky — do nothing else
  revalidatePath('/')
}

export async function addTopic(memberId: number, date: string, text: string) {
  await db.insert(topics).values({ date, presenterId: memberId, text })
  revalidatePath('/')
}
