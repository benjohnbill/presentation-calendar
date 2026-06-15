# Presentation Calendar MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A web calendar where friends mark available dates; a date provisionally establishes at 4 available members and becomes a Session at 4 commits, with targeted Discord notifications.

**Architecture:** Next.js (App Router, TypeScript) full-stack on Vercel. Reads via Server Components, mutations via Server Actions. All threshold/notification decisions are **pure functions** (TDD'd in isolation); Server Actions are thin glue that read/write Drizzle + call the pure functions + fire the Discord webhook. Daily reminder via Vercel Cron. Supabase Postgres is the store.

**Tech Stack:** Next.js 15, TypeScript, Drizzle ORM + `postgres` driver, Supabase Postgres, Tailwind CSS, Vitest, Vercel (hosting + Cron), Discord webhook.

See [`CONTEXT.md`](../../../CONTEXT.md) (glossary), [`docs/adr/0001`](../../adr/0001-nextjs-fullstack-supabase.md) (stack rationale), [`docs/system-guide.md`](../../system-guide.md) (system explainer).

---

## File Structure

```
db/
  schema.ts            Drizzle tables: members, availabilities, commits, sessions, topics, notifications
  client.ts            Drizzle client (singleton)
  seed.ts              Seeds members from seed/roster.json
domain/
  thresholds.ts        Pure: shouldFireProvisional, shouldCreateSession (THRESHOLD=4)
  thresholds.test.ts
  suggestedTime.ts     Pure: computeSuggestedTime(windows) via sweep line
  suggestedTime.test.ts
  time.ts              Pure: formatWindow, normalizeWindow helpers
  time.test.ts
notify/
  messages.ts          Pure builders: buildProvisional, buildSessionCreated, buildReminder
  messages.test.ts
  discord.ts           Thin sender: postToDiscord(payload)
app/
  layout.tsx           Root layout (Apple-minimal shell)
  page.tsx             Main: calendar (rolling 8wk) + session panel (Server Component)
  actions.ts           Server Actions: markAvailable, unmarkAvailable, commit, uncommit, addTopic
  api/cron/reminder/route.ts   Cron endpoint (CRON_SECRET guarded)
  _components/
    NamePicker.tsx     Client: pick identity, persist to localStorage
    Calendar.tsx       Client: 8-week grid, heatmap cells
    DateDetail.tsx     Client: per-day timetable (columns=members) + commit/topic inputs
    SessionPanel.tsx   Server-fed list: upcoming + past sessions
data/
  queries.ts           Read helpers (calendar state, date detail, sessions) — used by Server Components
lib/
  dates.ts             Pure: rollingWindowDates(today, weeks), KST helpers
  dates.test.ts
seed/roster.json       (exists) member seed
drizzle.config.ts
vitest.config.ts
vercel.json            Cron config
.env.local             DATABASE_URL, DISCORD_WEBHOOK_URL, CRON_SECRET (not committed)
```

---

## Phase 0 — Scaffolding & Infra

### Task 0.1: Initialize Next.js project

**Files:**
- Create: project root files via scaffolder

- [ ] **Step 1: Scaffold Next.js**

Run (in repo root, which already contains CONTEXT.md/docs/seed):
```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir=false --import-alias "@/*" --no-turbopack
```
When prompted that the directory is non-empty, keep existing files (`CONTEXT.md`, `docs/`, `seed/`). If the CLI refuses, scaffold into a temp dir and move generated files in, preserving the existing ones.

- [ ] **Step 2: Verify dev server boots**

Run: `npm run dev`
Expected: Next.js starts on http://localhost:3000 with the default page. Stop it (Ctrl-C).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app (ts, app router, tailwind)"
```

### Task 0.2: Install dependencies

- [ ] **Step 1: Install runtime + dev deps**

```bash
npm install drizzle-orm postgres
npm install -D drizzle-kit vitest @vitejs/plugin-react vite-tsconfig-paths tsx dotenv
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add drizzle, postgres, vitest deps"
```

### Task 0.3: Vitest config + env template

**Files:**
- Create: `vitest.config.ts`, `.env.example`
- Modify: `.gitignore` (ensure `.env.local` ignored — create-next-app already ignores `.env*.local`)

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
  },
})
```

- [ ] **Step 2: Add test script to `package.json`**

In `package.json` `"scripts"`, add:
```json
"test": "vitest run",
"test:watch": "vitest",
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:seed": "tsx db/seed.ts"
```

- [ ] **Step 3: Create `.env.example`**

```
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/xxx/yyy
CRON_SECRET=generate-a-long-random-string
```

- [ ] **Step 4: Sanity-run vitest (no tests yet)**

Run: `npm test`
Expected: vitest runs, reports "no test files found" (exit 0 or 1 with that message) — config is valid.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json .env.example
git commit -m "chore: vitest config, npm scripts, env template"
```

---

## Phase 1 — Data Layer

### Task 1.1: Drizzle schema

**Files:**
- Create: `db/schema.ts`

- [ ] **Step 1: Write `db/schema.ts`**

```ts
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
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const topics = pgTable('topics', {
  id: serial('id').primaryKey(),
  date: date('date').notNull(),
  presenterId: integer('presenter_id').notNull().references(() => members.id),
  text: text('text').notNull(),
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
```

Note: `unique(date, eventType)` on `notifications` enforces webhook idempotency at the DB level (a duplicate insert throws).

- [ ] **Step 2: Create `drizzle.config.ts`**

```ts
import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
})
```

- [ ] **Step 3: Commit**

```bash
git add db/schema.ts drizzle.config.ts
git commit -m "feat(db): drizzle schema for members/availabilities/commits/sessions/topics/notifications"
```

### Task 1.2: Drizzle client

**Files:**
- Create: `db/client.ts`

- [ ] **Step 1: Write `db/client.ts`**

```ts
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const client = postgres(process.env.DATABASE_URL!, { prepare: false })
export const db = drizzle(client, { schema })
```

- [ ] **Step 2: Commit**

```bash
git add db/client.ts
git commit -m "feat(db): drizzle client singleton"
```

### Task 1.3: Seed script

**Files:**
- Create: `db/seed.ts`
- Read: `seed/roster.json` (exists)

- [ ] **Step 1: Write `db/seed.ts`**

```ts
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { db } from './client'
import { members } from './schema'

type RosterEntry = { name: string; discordId: string }

async function main() {
  const roster: RosterEntry[] = JSON.parse(readFileSync('seed/roster.json', 'utf8'))
  for (const m of roster) {
    await db.insert(members).values({ name: m.name, discordId: m.discordId }).onConflictDoNothing()
  }
  console.log(`Seeded ${roster.length} members`)
  process.exit(0)
}

main()
```

Note: run after migrations exist and `DATABASE_URL` is set (Phase 7). Do not run yet.

- [ ] **Step 2: Commit**

```bash
git add db/seed.ts
git commit -m "feat(db): seed members from seed/roster.json"
```

---

## Phase 2 — Domain Logic (pure, TDD)

### Task 2.1: Threshold decisions

**Files:**
- Create: `domain/thresholds.ts`
- Test: `domain/thresholds.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// domain/thresholds.test.ts
import { describe, it, expect } from 'vitest'
import { THRESHOLD, shouldFireProvisional, shouldCreateSession } from './thresholds'

describe('shouldFireProvisional', () => {
  it('fires when count reaches threshold, no session, not yet notified', () => {
    expect(shouldFireProvisional({ availableCount: 4, sessionExists: false, alreadyNotified: false })).toBe(true)
  })
  it('does not fire below threshold', () => {
    expect(shouldFireProvisional({ availableCount: 3, sessionExists: false, alreadyNotified: false })).toBe(false)
  })
  it('does not fire if already notified (idempotent)', () => {
    expect(shouldFireProvisional({ availableCount: 5, sessionExists: false, alreadyNotified: true })).toBe(false)
  })
  it('does not fire if a session already exists', () => {
    expect(shouldFireProvisional({ availableCount: 5, sessionExists: true, alreadyNotified: false })).toBe(false)
  })
})

describe('shouldCreateSession', () => {
  it('creates when commits reach threshold and no session yet', () => {
    expect(shouldCreateSession({ commitCount: 4, sessionExists: false })).toBe(true)
  })
  it('does not create below threshold', () => {
    expect(shouldCreateSession({ commitCount: 3, sessionExists: false })).toBe(false)
  })
  it('does not create twice (session already exists)', () => {
    expect(shouldCreateSession({ commitCount: 6, sessionExists: true })).toBe(false)
  })
})

it('threshold is 4', () => {
  expect(THRESHOLD).toBe(4)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run domain/thresholds.test.ts`
Expected: FAIL — cannot import from `./thresholds` (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
// domain/thresholds.ts
export const THRESHOLD = 4

export function shouldFireProvisional(args: {
  availableCount: number
  sessionExists: boolean
  alreadyNotified: boolean
}): boolean {
  return args.availableCount >= THRESHOLD && !args.sessionExists && !args.alreadyNotified
}

export function shouldCreateSession(args: {
  commitCount: number
  sessionExists: boolean
}): boolean {
  return args.commitCount >= THRESHOLD && !args.sessionExists
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run domain/thresholds.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add domain/thresholds.ts domain/thresholds.test.ts
git commit -m "feat(domain): threshold decisions for provisional + session creation (TDD)"
```

### Task 2.2: Time window normalization

**Files:**
- Create: `domain/time.ts`
- Test: `domain/time.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// domain/time.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeWindow, formatWindow } from './time'

describe('normalizeWindow', () => {
  it('treats both null as full day (anytime)', () => {
    expect(normalizeWindow({ start: null, end: null })).toEqual({ startMin: 0, endMin: 1440 })
  })
  it('open-ended start (7시~) runs to end of day', () => {
    expect(normalizeWindow({ start: '19:00', end: null })).toEqual({ startMin: 1140, endMin: 1440 })
  })
  it('closed window', () => {
    expect(normalizeWindow({ start: '19:00', end: '21:00' })).toEqual({ startMin: 1140, endMin: 1260 })
  })
})

describe('formatWindow', () => {
  it('anytime', () => {
    expect(formatWindow({ start: null, end: null })).toBe('시간무관')
  })
  it('open-ended', () => {
    expect(formatWindow({ start: '19:00', end: null })).toBe('19:00~')
  })
  it('closed', () => {
    expect(formatWindow({ start: '19:00', end: '21:00' })).toBe('19:00~21:00')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run domain/time.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// domain/time.ts
export type TimeWindow = { start: string | null; end: string | null } // 'HH:MM' | null

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function normalizeWindow(w: TimeWindow): { startMin: number; endMin: number } {
  return {
    startMin: w.start === null ? 0 : toMin(w.start),
    endMin: w.end === null ? 1440 : toMin(w.end),
  }
}

export function formatWindow(w: TimeWindow): string {
  if (w.start === null && w.end === null) return '시간무관'
  if (w.end === null) return `${w.start}~`
  if (w.start === null) return `~${w.end}`
  return `${w.start}~${w.end}`
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run domain/time.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add domain/time.ts domain/time.test.ts
git commit -m "feat(domain): time window normalize + format (TDD)"
```

### Task 2.3: Suggested Time (overlap sweep line)

**Files:**
- Create: `domain/suggestedTime.ts`
- Test: `domain/suggestedTime.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// domain/suggestedTime.test.ts
import { describe, it, expect } from 'vitest'
import { computeSuggestedTime } from './suggestedTime'

describe('computeSuggestedTime', () => {
  it('returns the span where >=4 windows overlap', () => {
    // 3 people from 19:00~, 1 person 20:00~22:00 -> 4 overlap only in 20:00..22:00
    const windows = [
      { start: '19:00', end: null },
      { start: '19:00', end: null },
      { start: '19:00', end: null },
      { start: '20:00', end: '22:00' },
    ]
    expect(computeSuggestedTime(windows, 4)).toEqual({ start: '20:00', end: '22:00' })
  })
  it('anytime members count across the whole day', () => {
    const windows = [
      { start: null, end: null },
      { start: null, end: null },
      { start: '19:00', end: null },
      { start: '19:00', end: null },
    ]
    expect(computeSuggestedTime(windows, 4)).toEqual({ start: '19:00', end: '24:00' })
  })
  it('returns null when overlap never reaches threshold', () => {
    const windows = [
      { start: '18:00', end: '19:00' },
      { start: '20:00', end: '21:00' },
      { start: '22:00', end: '23:00' },
      { start: '08:00', end: '09:00' },
    ]
    expect(computeSuggestedTime(windows, 4)).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run domain/suggestedTime.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// domain/suggestedTime.ts
import { normalizeWindow, type TimeWindow } from './time'

function fmt(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Returns the first contiguous span where coverage >= threshold, or null.
export function computeSuggestedTime(
  windows: TimeWindow[],
  threshold: number,
): { start: string; end: string } | null {
  const deltas = new Map<number, number>()
  for (const w of windows) {
    const { startMin, endMin } = normalizeWindow(w)
    deltas.set(startMin, (deltas.get(startMin) ?? 0) + 1)
    deltas.set(endMin, (deltas.get(endMin) ?? 0) - 1)
  }
  const points = [...deltas.keys()].sort((a, b) => a - b)
  let running = 0
  let spanStart: number | null = null
  for (let i = 0; i < points.length; i++) {
    running += deltas.get(points[i])!
    if (running >= threshold && spanStart === null) {
      spanStart = points[i]
    } else if (running < threshold && spanStart !== null) {
      return { start: fmt(spanStart), end: fmt(points[i]) }
    }
  }
  return null
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run domain/suggestedTime.test.ts`
Expected: PASS (all three cases).

- [ ] **Step 5: Commit**

```bash
git add domain/suggestedTime.ts domain/suggestedTime.test.ts
git commit -m "feat(domain): suggested time via overlap sweep line (TDD)"
```

### Task 2.4: Rolling-window dates (calendar horizon, KST)

**Files:**
- Create: `lib/dates.ts`
- Test: `lib/dates.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/dates.test.ts
import { describe, it, expect } from 'vitest'
import { rollingWindowDates } from '@/lib/dates'

describe('rollingWindowDates', () => {
  it('returns N weeks of dates starting today (inclusive)', () => {
    const dates = rollingWindowDates(new Date('2026-06-15T00:00:00+09:00'), 8)
    expect(dates[0]).toBe('2026-06-15')
    expect(dates).toHaveLength(8 * 7)
    expect(dates[dates.length - 1]).toBe('2026-08-09')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/dates.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/dates.ts
// Format a Date as YYYY-MM-DD in KST.
export function toKstDateString(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

export function rollingWindowDates(today: Date, weeks: number): string[] {
  const out: string[] = []
  const start = new Date(toKstDateString(today) + 'T00:00:00Z')
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/dates.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/dates.ts lib/dates.test.ts
git commit -m "feat(lib): rolling-window dates with KST normalization (TDD)"
```

---

## Phase 3 — Discord Notifications

### Task 3.1: Message builders (pure, TDD)

**Files:**
- Create: `notify/messages.ts`
- Test: `notify/messages.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// notify/messages.test.ts
import { describe, it, expect } from 'vitest'
import { buildProvisional, buildSessionCreated, buildReminder } from './messages'

const url = 'https://app.example/d/2026-06-20'

describe('buildProvisional', () => {
  it('mentions available members and links the date', () => {
    const msg = buildProvisional({ date: '2026-06-20', mentionIds: ['111', '222'], url })
    expect(msg.content).toContain('2026-06-20')
    expect(msg.content).toContain('<@111>')
    expect(msg.content).toContain('<@222>')
    expect(msg.content).toContain(url)
    expect(msg.allowed_mentions).toEqual({ users: ['111', '222'] })
  })
})

describe('buildSessionCreated', () => {
  it('includes each member time line, suggested time, mentions', () => {
    const msg = buildSessionCreated({
      date: '2026-06-20',
      lines: ['철수  19:00~', '영희  시간무관'],
      suggested: { start: '19:00', end: '24:00' },
      mentionIds: ['111', '222'],
      url,
    })
    expect(msg.content).toContain('철수  19:00~')
    expect(msg.content).toContain('영희  시간무관')
    expect(msg.content).toContain('19:00~24:00')
    expect(msg.content).toContain('<@111>')
    expect(msg.allowed_mentions).toEqual({ users: ['111', '222'] })
  })
  it('omits suggested line when null', () => {
    const msg = buildSessionCreated({
      date: '2026-06-20', lines: ['철수  18:00~19:00'], suggested: null, mentionIds: ['111'], url,
    })
    expect(msg.content).not.toContain('겹치는 시간')
  })
})

describe('buildReminder', () => {
  it('reminds committed members of today session', () => {
    const msg = buildReminder({ date: '2026-06-20', mentionIds: ['111'], url })
    expect(msg.content).toContain('2026-06-20')
    expect(msg.allowed_mentions).toEqual({ users: ['111'] })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run notify/messages.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// notify/messages.ts
export type DiscordMessage = {
  content: string
  allowed_mentions: { users: string[] }
}

const mentions = (ids: string[]) => ids.map((id) => `<@${id}>`).join(' ')

export function buildProvisional(a: { date: string; mentionIds: string[]; url: string }): DiscordMessage {
  return {
    content:
      `🔥 ${a.date} 잠정 성립 — 4명 가능!\n` +
      `시간표 열렸어요. 들어와서 가능 시간 남겨주세요. (4명 commit하면 세션 생성)\n` +
      `👉 ${a.url}\n${mentions(a.mentionIds)}`,
    allowed_mentions: { users: a.mentionIds },
  }
}

export function buildSessionCreated(a: {
  date: string
  lines: string[]
  suggested: { start: string; end: string } | null
  mentionIds: string[]
  url: string
}): DiscordMessage {
  const suggestedLine = a.suggested ? `\n✨ 다 겹치는 시간: ${a.suggested.start}~${a.suggested.end}` : ''
  return {
    content:
      `🎉 세션 생성! — ${a.date}\n` +
      `🕖 각자 가능 시간:\n` +
      a.lines.map((l) => ` · ${l}`).join('\n') +
      suggestedLine +
      `\n카톡에서 최종 시간 정하자! 🔗 ${a.url}\n${mentions(a.mentionIds)}`,
    allowed_mentions: { users: a.mentionIds },
  }
}

export function buildReminder(a: { date: string; mentionIds: string[]; url: string }): DiscordMessage {
  return {
    content: `⏰ 오늘 ${a.date} 세션 있어요! 시간은 카톡 확인.\n👉 ${a.url}\n${mentions(a.mentionIds)}`,
    allowed_mentions: { users: a.mentionIds },
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run notify/messages.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add notify/messages.ts notify/messages.test.ts
git commit -m "feat(notify): discord message builders (TDD)"
```

### Task 3.2: Discord sender (thin IO)

**Files:**
- Create: `notify/discord.ts`

- [ ] **Step 1: Write `notify/discord.ts`**

```ts
import type { DiscordMessage } from './messages'

export async function postToDiscord(msg: DiscordMessage): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL
  if (!url) throw new Error('DISCORD_WEBHOOK_URL not set')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(msg),
  })
  if (!res.ok) {
    throw new Error(`Discord webhook failed: ${res.status} ${await res.text()}`)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add notify/discord.ts
git commit -m "feat(notify): thin discord webhook sender"
```

---

## Phase 4 — Data Access & Server Actions

### Task 4.1: Read queries

**Files:**
- Create: `data/queries.ts`

- [ ] **Step 1: Write `data/queries.ts`**

```ts
import { db } from '@/db/client'
import { members, availabilities, commits, sessions, topics } from '@/db/schema'
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
```

- [ ] **Step 2: Commit**

```bash
git add data/queries.ts
git commit -m "feat(data): read queries for calendar + date detail"
```

### Task 4.2: Server Actions — availability

**Files:**
- Create: `app/actions.ts`

- [ ] **Step 1: Write `markAvailable` / `unmarkAvailable` in `app/actions.ts`**

```ts
'use server'

import { db } from '@/db/client'
import { availabilities, commits, sessions, notifications, members } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { shouldFireProvisional } from '@/domain/thresholds'
import { buildProvisional } from '@/notify/messages'
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `app/actions.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/actions.ts
git commit -m "feat(actions): markAvailable (fires provisional) + unmarkAvailable (cascades uncommit)"
```

### Task 4.3: Server Actions — commit / uncommit / topic

**Files:**
- Modify: `app/actions.ts`

- [ ] **Step 1: Append commit/uncommit/addTopic to `app/actions.ts`**

```ts
import { shouldCreateSession } from '@/domain/thresholds'
import { computeSuggestedTime } from '@/domain/suggestedTime'
import { formatWindow } from '@/domain/time'
import { buildSessionCreated } from '@/notify/messages'
import { topics } from '@/db/schema'

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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/actions.ts
git commit -m "feat(actions): commit (creates sticky session + digest), uncommit, addTopic"
```

---

## Phase 5 — Frontend

> Aesthetic direction: **Apple-minimal** (see system-guide §디자인 방향). After these components are functional, run the **frontend-design** skill to refine typography/spacing/color — especially the Calendar heatmap and the timetable overlap (the two signature components). The code below is functional-first; styling is intentionally minimal and meant to be elevated by that pass.

### Task 5.1: Identity (NamePicker, localStorage)

**Files:**
- Create: `app/_components/NamePicker.tsx`

- [ ] **Step 1: Write `app/_components/NamePicker.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'

export type Member = { id: number; name: string }

export function useIdentity() {
  const [id, setId] = useState<number | null>(null)
  useEffect(() => {
    const v = localStorage.getItem('memberId')
    if (v) setId(Number(v))
  }, [])
  const pick = (memberId: number) => {
    localStorage.setItem('memberId', String(memberId))
    setId(memberId)
  }
  return { id, pick }
}

export function NamePicker({ members, value, onPick }: { members: Member[]; value: number | null; onPick: (id: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {members.map((m) => (
        <button
          key={m.id}
          onClick={() => onPick(m.id)}
          className={`rounded-full px-4 py-1.5 text-sm transition ${value === m.id ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          {m.name}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/_components/NamePicker.tsx
git commit -m "feat(ui): name picker with localStorage identity"
```

### Task 5.2: Calendar (rolling 8wk heatmap)

**Files:**
- Create: `app/_components/Calendar.tsx`

- [ ] **Step 1: Write `app/_components/Calendar.tsx`**

```tsx
'use client'

type Props = {
  dates: string[]                       // rolling window, YYYY-MM-DD
  counts: Record<string, number>        // date -> available count
  sessionDates: Set<string>
  myDates: Set<string>                  // dates the current member is available
  onToggle: (date: string) => void
  onOpen: (date: string) => void
}

function heat(count: number): string {
  if (count >= 4) return 'bg-orange-500 text-white'
  if (count === 3) return 'bg-orange-300'
  if (count === 2) return 'bg-orange-100'
  if (count === 1) return 'bg-orange-50'
  return 'bg-white'
}

export function Calendar({ dates, counts, sessionDates, myDates, onToggle, onOpen }: Props) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {dates.map((d) => {
        const count = counts[d] ?? 0
        const isSession = sessionDates.has(d)
        const mine = myDates.has(d)
        const day = Number(d.slice(8, 10))
        return (
          <div key={d} className={`relative rounded-lg border p-2 text-center text-sm ${heat(count)} ${isSession ? 'ring-2 ring-green-500' : ''}`}>
            <div className="text-[11px] text-gray-500">{d.slice(5)}</div>
            <button onClick={() => onToggle(d)} className={`mt-1 block w-full rounded ${mine ? 'font-bold underline' : ''}`}>
              {count > 0 ? `${count}명` : '·'}
            </button>
            {count >= 4 && (
              <button onClick={() => onOpen(d)} className="mt-1 text-[11px] text-blue-600 underline">
                시간표
              </button>
            )}
            {isSession && <span className="absolute right-1 top-1 text-green-600">✓</span>}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/_components/Calendar.tsx
git commit -m "feat(ui): rolling 8-week calendar with availability heatmap"
```

### Task 5.3: DateDetail timetable (columns=members)

**Files:**
- Create: `app/_components/DateDetail.tsx`

- [ ] **Step 1: Write `app/_components/DateDetail.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { formatWindow } from '@/domain/time'

type Member = { id: number; name: string }
type CommitRow = { memberId: number; timeStart: string | null; timeEnd: string | null }
type TopicRow = { presenterId: number; text: string }

type Props = {
  date: string
  members: Member[]
  commits: CommitRow[]
  topics: TopicRow[]
  suggested: { start: string; end: string } | null
  myId: number
  onCommit: (window: { start: string | null; end: string | null }) => void
  onUncommit: () => void
  onAddTopic: (text: string) => void
}

const HOURS = Array.from({ length: 13 }, (_, i) => 12 + i) // 12:00 .. 24:00

export function DateDetail({ date, members, commits, topics, suggested, myId, onCommit, onUncommit, onAddTopic }: Props) {
  const [start, setStart] = useState('19:00')
  const [end, setEnd] = useState('')
  const [anytime, setAnytime] = useState(false)
  const [topic, setTopic] = useState('')
  const byMember = new Map(commits.map((c) => [c.memberId, c]))

  return (
    <div className="rounded-xl border p-4">
      <h2 className="mb-3 text-lg font-semibold">{date} 시간표</h2>

      <div className="flex gap-2 overflow-x-auto">
        {members.map((m) => {
          const c = byMember.get(m.id)
          return (
            <div key={m.id} className="min-w-[64px] text-center">
              <div className="mb-1 text-xs font-medium">{m.name}</div>
              <div className="relative h-48 w-14 rounded bg-gray-50">
                {c && <Bar start={c.timeStart} end={c.timeEnd} suggested={suggested} />}
              </div>
              <div className="mt-1 text-[10px] text-gray-500">
                {c ? formatWindow({ start: c.timeStart, end: c.timeEnd }) : '-'}
              </div>
            </div>
          )
        })}
      </div>

      {suggested && (
        <p className="mt-3 text-sm text-orange-600">✨ 다 겹치는 시간: {suggested.start}~{suggested.end}</p>
      )}

      <div className="mt-4 space-y-2 border-t pt-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={anytime} onChange={(e) => setAnytime(e.target.checked)} /> 시간무관
        </label>
        {!anytime && (
          <div className="flex items-center gap-2 text-sm">
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="rounded border px-2 py-1" />
            ~
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded border px-2 py-1" placeholder="(이후)" />
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => onCommit(anytime ? { start: null, end: null } : { start: start || null, end: end || null })}
            className="rounded-lg bg-black px-4 py-1.5 text-sm text-white"
          >
            하자 (참석)
          </button>
          {byMember.has(myId) && (
            <button onClick={onUncommit} className="rounded-lg bg-gray-100 px-4 py-1.5 text-sm">참석 취소</button>
          )}
        </div>
      </div>

      <div className="mt-4 border-t pt-4">
        <div className="mb-1 text-sm font-medium">발표자/주제</div>
        <ul className="mb-2 text-sm text-gray-700">
          {topics.map((t, i) => {
            const name = members.find((m) => m.id === t.presenterId)?.name ?? '?'
            return <li key={i}>· {name}: {t.text}</li>
          })}
        </ul>
        <div className="flex gap-2">
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="뭐 할지 (선택)" className="flex-1 rounded border px-2 py-1 text-sm" />
          <button onClick={() => { if (topic) { onAddTopic(topic); setTopic('') } }} className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm">추가</button>
        </div>
      </div>
    </div>
  )
}

function Bar({ start, end, suggested }: { start: string | null; end: string | null; suggested: { start: string; end: string } | null }) {
  const dayStart = 12 * 60
  const dayEnd = 24 * 60
  const span = dayEnd - dayStart
  const toMin = (s: string | null, fallback: number) => (s ? Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5)) : fallback)
  const s = Math.max(toMin(start, dayStart), dayStart)
  const e = Math.min(toMin(end, dayEnd), dayEnd)
  const top = ((s - dayStart) / span) * 100
  const height = ((e - s) / span) * 100
  return <div className="absolute left-1 right-1 rounded bg-orange-400/70" style={{ top: `${top}%`, height: `${height}%` }} />
}
```

Note: hour axis is `HOURS` (12:00–24:00) — adjust to taste during the frontend-design pass (an "iterate on the real thing" UX detail).

- [ ] **Step 2: Commit**

```bash
git add app/_components/DateDetail.tsx
git commit -m "feat(ui): per-day timetable (columns=members, bar output, commit/topic inputs)"
```

### Task 5.4: SessionPanel + main page wiring

**Files:**
- Create: `app/_components/SessionPanel.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Write `app/_components/SessionPanel.tsx`**

```tsx
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
```

- [ ] **Step 2: Write `app/page.tsx` (Server Component) wiring it together**

```tsx
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
```

- [ ] **Step 3: Create `app/_components/CalendarClient.tsx` (client glue calling actions)**

```tsx
'use client'
import { useRouter } from 'next/navigation'
import { NamePicker, useIdentity } from './NamePicker'
import { Calendar } from './Calendar'
import { DateDetail } from './DateDetail'
import { markAvailable, unmarkAvailable, commit, uncommit, addTopic } from '../actions'

type Member = { id: number; name: string }
type Avail = { memberId: number; date: string }

export function CalendarClient(props: {
  members: Member[]
  dates: string[]
  counts: Record<string, number>
  sessionDates: string[]
  availability: Avail[]
  openDate: string | null
  detail: { avail: Avail[]; comm: any[]; tops: any[] } | null
  suggested: { start: string; end: string } | null
}) {
  const router = useRouter()
  const { id: myId, pick } = useIdentity()

  if (myId === null) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">누구세요? 이름을 골라주세요.</p>
        <NamePicker members={props.members} value={null} onPick={pick} />
      </div>
    )
  }

  const myDates = new Set(props.availability.filter((a) => a.memberId === myId).map((a) => a.date))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>나:</span>
        <NamePicker members={props.members} value={myId} onPick={pick} />
      </div>

      <Calendar
        dates={props.dates}
        counts={props.counts}
        sessionDates={new Set(props.sessionDates)}
        myDates={myDates}
        onToggle={async (d) => {
          if (myDates.has(d)) await unmarkAvailable(myId, d)
          else await markAvailable(myId, d)
          router.refresh()
        }}
        onOpen={(d) => router.push(`/?date=${d}`)}
      />

      {props.openDate && props.detail && (
        <DateDetail
          date={props.openDate}
          members={props.members}
          commits={props.detail.comm}
          topics={props.detail.tops}
          suggested={props.suggested}
          myId={myId}
          onCommit={async (w) => { await commit(myId, props.openDate!, w); router.refresh() }}
          onUncommit={async () => { await uncommit(myId, props.openDate!); router.refresh() }}
          onAddTopic={async (t) => { await addTopic(myId, props.openDate!, t); router.refresh() }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Type-check + boot**

Run: `npx tsc --noEmit && npm run dev`
Expected: compiles; page renders the name picker, then calendar after picking (DB must be reachable — Phase 7 sets `DATABASE_URL`). Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/_components/SessionPanel.tsx app/_components/CalendarClient.tsx
git commit -m "feat(ui): main page wiring — calendar + date detail + session panel via server actions"
```

---

## Phase 6 — Cron Reminder

### Task 6.1: Reminder route + vercel.json

**Files:**
- Create: `app/api/cron/reminder/route.ts`, `vercel.json`

- [ ] **Step 1: Write `app/api/cron/reminder/route.ts`**

```ts
import { db } from '@/db/client'
import { sessions, commits, members, notifications } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { toKstDateString } from '@/lib/dates'
import { buildReminder } from '@/notify/messages'
import { postToDiscord } from '@/notify/discord'

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
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? ''
    await postToDiscord(buildReminder({ date: s.date, mentionIds, url: `${base}/?date=${s.date}` }))
  }

  return Response.json({ ok: true, reminded: todays.length })
}
```

- [ ] **Step 2: Write `vercel.json` (9am KST = 00:00 UTC)**

```json
{
  "crons": [{ "path": "/api/cron/reminder", "schedule": "0 0 * * *" }]
}
```

Note: Vercel Cron runs in **UTC**. `0 0 * * *` = 00:00 UTC = 09:00 KST. Vercel attaches the `CRON_SECRET` as a Bearer token automatically when set in project env.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/reminder/route.ts vercel.json
git commit -m "feat(cron): daily 9am KST reminder for today's sessions (idempotent, secret-guarded)"
```

---

## Phase 7 — Deploy & Live Wiring

### Task 7.1: Supabase + migrations + seed

- [ ] **Step 1: Create Supabase project**

Create a project at supabase.com. Copy the connection string (Project Settings → Database → Connection string → URI, "Transaction" pooler). Put it in `.env.local` as `DATABASE_URL`. (Request these secrets from the user if running headless.)

- [ ] **Step 2: Generate + run migrations**

```bash
npm run db:generate
npm run db:migrate
```
Expected: `drizzle/` migration files created; tables created in Supabase.

- [ ] **Step 3: Seed members**

```bash
npm run db:seed
```
Expected: "Seeded 5 members".

- [ ] **Step 4: Local smoke test**

Run: `npm run dev`, open http://localhost:3000, pick a name, mark 4 different members available on the same date (use 4 browsers/incognito or temporarily switch identity), confirm the date hits "4명" and the **provisional Discord message arrives**. Then open the timetable and commit 4 times → confirm **session-created Discord message** arrives and the session appears in the panel.

- [ ] **Step 5: Commit migration files**

```bash
git add drizzle/
git commit -m "chore(db): initial migration"
```

### Task 7.2: GitHub + Vercel

- [ ] **Step 1: Create GitHub repo and push**

```bash
gh repo create presentation-calendar --private --source=. --remote=origin --push
```

- [ ] **Step 2: Connect to Vercel**

Import the repo at vercel.com (or `vercel link`). In Vercel project settings → Environment Variables, add: `DATABASE_URL`, `DISCORD_WEBHOOK_URL`, `CRON_SECRET`, `NEXT_PUBLIC_BASE_URL` (the deployed URL).

- [ ] **Step 3: Deploy + verify**

Push to `main` → Vercel auto-deploys. Open the deployed URL; repeat the smoke test against production. Confirm the cron appears under Vercel → Settings → Cron Jobs.

- [ ] **Step 4: Pin the link in Discord + KakaoTalk** (manual, by the user).

---

## Self-Review

**1. Spec coverage (against CONTEXT.md / system-guide.md):**
- Open Calendar (rolling 8wk) → Task 2.4, 5.2 ✓
- Available (date-level) + provisional at 4 → 2.1, 4.2 ✓
- Commit (date + free time window) + session at 4 → 2.2, 4.3, 5.3 ✓
- Suggested Time (overlap, non-gating) → 2.3, used in 4.3/5.3 ✓
- Sticky session (materialized; uncommit doesn't delete) → 4.3 (`uncommit`) ✓
- Identity (no-login, roster + discord_id) → 1.3, 5.1 ✓
- Targeted Discord mentions (provisional→available, session/reminder→committers) → 3.1, 4.2, 4.3, 6.1 ✓
- Idempotent webhooks (`notifications` unique) → 1.1, 4.2, 4.3, 6.1 ✓
- Reminder (daily 9am KST, UTC cron) → 6.1 ✓
- Topic (발표자/주제, on date, 0..N) → 4.3, 5.3 ✓
- Full-public visibility (counts + names) → 5.2, 5.3 ✓
- Past roll-off + session history panel → 5.4 ✓
- Withdrawal (unavailable cascades uncommit; no notification) → 4.2 ✓
- KakaoTalk: no automation (only manual pin) → nothing built, correct ✓
- **Phase 2 items intentionally excluded:** Program, drag input, final-time recording, realtime, recruit notification, admin/cancel, history polish, design polish — none implemented, correct.

**2. Placeholder scan:** No TBD/"handle edge cases"/uncoded steps — every code step has full code. ✓

**3. Type consistency:** `TimeWindow {start,end}` consistent across `time.ts`/`suggestedTime.ts`/actions/UI; `DiscordMessage {content, allowed_mentions:{users}}` consistent across `messages.ts`/`discord.ts`; action signatures `(memberId, date, ...)` consistent with `CalendarClient` callers. ✓

**Known soft spots (acceptable for MVP, flagged):** the 4-identity smoke test needs multiple browsers (honor-system identity); timetable hour axis (12:00–24:00) and exact heatmap colors are UX details to refine in the frontend-design pass; concurrent-write race on threshold is guarded by the `notifications` unique constraint but the count read is not transactional (acceptable at 5-user scale).

---

## Amendment (2026-06-15, post-build) — Late-join notification

Surfaced by `final-check`: the agreed notification catalog included a *late-join* event that
was missing from the original plan. Added directly to the built code:

- `notify/messages.ts` — `buildLateJoin({ date, joinerName, count, suggested, url })`: a **quiet**
  message (`allowed_mentions: { users: [] }` — no ping) naming the joiner, the new count, and the
  refreshed suggested time. Covered by `notify/messages.test.ts`.
- `app/actions.ts` `commit()` — detects a **new** committer (no prior commit row for that date)
  vs. an existing one editing their time. If new **and** a session already existed, it fires the
  quiet late-join message. A pure time-edit by an existing committer fires nothing (by design).

