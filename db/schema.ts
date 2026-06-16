import { pgTable, serial, text, date, time, timestamp, integer, unique } from 'drizzle-orm/pg-core'

export const members = pgTable('members', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  discordId: text('discord_id').notNull(),
})

export const availabilities = pgTable(
  'availabilities',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id').notNull().references(() => members.id),
    date: date('date').notNull(),
  },
  (t) => ({ uniqMemberDate: unique().on(t.memberId, t.date) }),
)

export const commits = pgTable(
  'commits',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id').notNull().references(() => members.id),
    date: date('date').notNull(),
    timeStart: time('time_start'), // null allowed
    timeEnd: time('time_end'),     // null allowed
  },
  (t) => ({ uniqMemberDate: unique().on(t.memberId, t.date) }),
)

export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  date: date('date').notNull().unique(),
  finalTime: time('final_time'), // null until the group records the agreed start (humans finalize)
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const topics = pgTable('topics', {
  id: serial('id').primaryKey(),
  date: date('date').notNull(),
  presenterId: integer('presenter_id').notNull().references(() => members.id),
  text: text('text').notNull(),
})

export const materials = pgTable('materials', {
  id: serial('id').primaryKey(),
  date: date('date').notNull(),
  presenterId: integer('presenter_id').notNull().references(() => members.id),
  url: text('url').notNull(),
  label: text('label'), // optional human label, e.g. "본편 슬라이드"
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    date: date('date').notNull(),
    eventType: text('event_type').notNull(), // 'provisional' | 'session_created' | 'reminder'
    sentAt: timestamp('sent_at').notNull().defaultNow(),
  },
  (t) => ({ uniqDateEvent: unique().on(t.date, t.eventType) }),
)
