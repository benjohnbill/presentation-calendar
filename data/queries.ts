import { db } from '@/db/client'
import { members, availabilities, commits, sessions, topics, materials } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'

export async function getMembers() {
  return db.select().from(members)
}

// availability counts per date for a set of dates
export async function getAvailabilityByDates(dates: string[]) {
  if (dates.length === 0) return [] as { memberId: number; date: string }[]
  return db.select().from(availabilities).where(inArray(availabilities.date, dates))
}

export async function getSessionDates() {
  return db.select().from(sessions)
}

export async function getDateDetail(date: string) {
  const [avail, comm, tops] = await Promise.all([
    db.select().from(availabilities).where(eq(availabilities.date, date)),
    db.select().from(commits).where(eq(commits.date, date)),
    db.select().from(topics).where(eq(topics.date, date)),
  ])
  return { avail, comm, tops }
}

export async function getTopicsByDates(dates: string[]) {
  if (dates.length === 0) return [] as { date: string; presenterId: number; text: string }[]
  return db.select().from(topics).where(inArray(topics.date, dates))
}

export async function getMaterialsByDates(dates: string[]) {
  if (dates.length === 0) return [] as { id: number; date: string; presenterId: number; url: string; label: string | null }[]
  return db.select().from(materials).where(inArray(materials.date, dates))
}
