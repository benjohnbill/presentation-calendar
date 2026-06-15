# 0001 — Next.js full-stack on Vercel with Supabase Postgres

Status: accepted

## Context

The app needs server-side execution for three things a purely static React site cannot do:
shared state across members (a database), firing a Discord webhook at the exact moment a date
crosses the 4-member threshold, and a daily reminder.

## Decision

Build as a single Next.js (App Router) full-stack app deployed to Vercel. All server logic —
mutations, threshold detection, webhook firing — lives in Next.js route handlers / server
actions in one codebase. Persistence is Supabase (Postgres) accessed via Drizzle ORM. Daily
reminders run on Vercel Cron. Discord is the only integrated platform; KakaoTalk stays
automation-free.

## Why

- **One codebase, one mental model.** "request → write DB → check threshold → fire webhook"
  reads top-to-bottom. This is a learn-while-building project, so it must be traceable and
  debuggable with `console.log`, not hidden in platform configuration.
- **Postgres over a document store.** The app's core operation is counting against thresholds
  ("are ≥4 members available on date X?"). That is native SQL and awkward in NoSQL.

## Considered options (rejected)

- **SPA (Vite) + Supabase as a full BaaS.** Server logic would hide in Supabase Database
  Webhooks / Edge Functions / pg_cron — fewer frameworks, but logic scattered into BaaS magic
  that a learner cannot easily trace or debug.
- **Firebase / Firestore.** NoSQL fights a count/threshold-centric relational model; its
  natural shape is the BaaS shape we rejected; scheduled functions require a billing-enabled
  plan.

## Consequences

- Webhook firing must be **idempotent**: a `notifications` log records which event already
  fired per date, so re-crossing the threshold (e.g. a 5th member) does not re-notify.
- Supabase's free tier pauses a project after ~7 days idle, but the daily 9am Vercel Cron query
  keeps it warm — the reminder doubles as a keep-alive.
- **Targeted** Discord mentions require each member's Discord ID, stored once in the Roster (no
  OAuth login).
