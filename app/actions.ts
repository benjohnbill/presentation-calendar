'use server'

import { db } from '@/db/client'
import { availabilities, commits, sessions, notifications, members, topics, materials, programs } from '@/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { shouldFireProvisional, shouldCreateSession } from '@/domain/thresholds'
import { computeSuggestedTime } from '@/domain/suggestedTime'
import { formatWindow } from '@/domain/time'
import { buildProvisional, buildSessionCreated, buildLateJoin, buildCancelled } from '@/notify/messages'
import { postToDiscord } from '@/notify/discord'

function dateUrl(date: string) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  return `${base}/?date=${date}`
}

// Evaluate one date's provisional threshold and fire the Discord ping once.
// Extracted so it can run off the response path (see applyAvailability + after()).
async function maybeFireProvisional(date: string) {
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
}

// Apply a whole batch of availability changes for one member in a single
// round-trip. The calendar collects taps/drags locally and confirms them all at
// once, so a multi-day selection costs one request instead of one per day
// (server actions are dispatched one-at-a-time on the client, so per-tap writes
// also serialize — batching removes that too).
export async function applyAvailability(memberId: number, adds: string[], removes: string[]) {
  // Removing availability cascades to any commit (Commit ⊆ Available).
  for (const date of removes) {
    await db.delete(commits).where(and(eq(commits.memberId, memberId), eq(commits.date, date)))
    await db.delete(availabilities).where(and(eq(availabilities.memberId, memberId), eq(availabilities.date, date)))
  }

  if (adds.length > 0) {
    await db
      .insert(availabilities)
      .values(adds.map((date) => ({ memberId, date })))
      .onConflictDoNothing()
  }

  // Refresh the UI immediately; the Discord pings must not block the response.
  revalidatePath('/')

  if (adds.length > 0) {
    after(async () => {
      for (const date of adds) await maybeFireProvisional(date)
    })
  }
}

export async function commit(
  memberId: number,
  date: string,
  window: { start: string | null; end: string | null },
) {
  // Commit ⊆ Available: ensure availability exists
  await db.insert(availabilities).values({ memberId, date }).onConflictDoNothing()

  // Distinguish a NEW committer (potential late join) from an existing one editing their time.
  const existing = await db
    .select()
    .from(commits)
    .where(and(eq(commits.memberId, memberId), eq(commits.date, date)))
  const isNewCommitter = existing.length === 0

  await db
    .insert(commits)
    .values({ memberId, date, timeStart: window.start, timeEnd: window.end })
    .onConflictDoUpdate({
      target: [commits.memberId, commits.date],
      set: { timeStart: window.start, timeEnd: window.end },
    })

  const comm = await db.select().from(commits).where(eq(commits.date, date))
  const sess = await db.select().from(sessions).where(eq(sessions.date, date))
  const sessionExisted = sess.length > 0

  if (shouldCreateSession({ commitCount: comm.length, sessionExists: sessionExisted })) {
    await db.insert(sessions).values({ date }).onConflictDoNothing()
    await db.insert(notifications).values({ date, eventType: 'session_created' }).onConflictDoNothing()

    // Build + send the ping off the response path so the confirm returns fast.
    after(async () => {
      const all = await db.select().from(members)
      const byId = new Map(all.map((m) => [m.id, m]))
      const windows = comm.map((c) => ({ start: c.timeStart, end: c.timeEnd }))
      const lines = comm.map((c) => `${byId.get(c.memberId)?.name ?? '?'}  ${formatWindow({ start: c.timeStart, end: c.timeEnd })}`)
      const suggested = computeSuggestedTime(windows, 4)
      const mentionIds = comm.map((c) => byId.get(c.memberId)?.discordId).filter(Boolean) as string[]
      await postToDiscord(buildSessionCreated({ date, lines, suggested, mentionIds, url: dateUrl(date) }))
    })
  } else if (isNewCommitter && sessionExisted) {
    // Late join: a new person commits to an already-created session. Quiet (no ping),
    // showing who joined, the new count, and the (possibly shifted) suggested time.
    after(async () => {
      const all = await db.select().from(members)
      const byId = new Map(all.map((m) => [m.id, m]))
      const windows = comm.map((c) => ({ start: c.timeStart, end: c.timeEnd }))
      const suggested = computeSuggestedTime(windows, 4)
      const joinerName = byId.get(memberId)?.name ?? '?'
      await postToDiscord(buildLateJoin({ date, joinerName, count: comm.length, suggested, url: dateUrl(date) }))
    })
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

export async function addMaterial(date: string, presenterId: number, url: string, label: string | null) {
  if (!/^https?:\/\//i.test(url)) throw new Error('URL must start with http:// or https://')
  await db.insert(materials).values({ date, presenterId, url, label })
  revalidatePath('/')
}

export async function removeMaterial(id: number) {
  await db.delete(materials).where(eq(materials.id, id))
  revalidatePath('/')
}

export async function setFinalTime(date: string, time: string | null) {
  await db.update(sessions).set({ finalTime: time }).where(eq(sessions.date, date))
  revalidatePath('/')
}

// Admin-only. Cancels a created Session per ADR 0002: notify committers, then revert the date
// (delete session + commits + this date's session_created/reminder notifications) so it can
// reform later. Availability and topics are kept; the date falls back to provisional.
export async function createProgram(hostId: number, date: string, label: string, note: string | null) {
  await db.insert(programs).values({ hostId, date, label, note })
  revalidatePath('/')
}

export async function deleteProgram(id: number) {
  await db.delete(programs).where(eq(programs.id, id))
  revalidatePath('/')
}

export async function cancelSession(memberId: number, date: string) {
  const actor = await db.select().from(members).where(eq(members.id, memberId))
  if (!actor[0]?.isAdmin) throw new Error('Only the admin can cancel a session')

  // Gather committers for the notification BEFORE purging.
  const comm = await db.select().from(commits).where(eq(commits.date, date))
  const all = await db.select().from(members)
  const byId = new Map(all.map((m) => [m.id, m]))
  const mentionIds = comm.map((c) => byId.get(c.memberId)?.discordId).filter(Boolean) as string[]

  await db.delete(sessions).where(eq(sessions.date, date))
  await db.delete(commits).where(eq(commits.date, date))
  await db
    .delete(notifications)
    .where(and(eq(notifications.date, date), inArray(notifications.eventType, ['session_created', 'reminder'])))

  revalidatePath('/')

  after(async () => {
    await postToDiscord(buildCancelled({ date, mentionIds, url: dateUrl(date) }))
  })
}
