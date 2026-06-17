# 0003 — Mutation responsiveness: optimistic UI over revalidate-await

Status: accepted (adopted incrementally — hot paths done 2026-06-17; cache-tag work deferred)

## Context

Every mutation is a Server Action that writes the DB and then calls `revalidatePath('/')`.
The whole app is a single dynamic RSC (`app/page.tsx`) that re-fetches *everything* on each
revalidation: the 3-month availability sweep, every qualifying timetable day's detail, and all
topics / materials / programs.

Two Next.js 16 facts compound into a visible stall:

- The client **dispatches and awaits Server Actions one at a time** (documented implementation
  detail, `getting-started/mutating-data`).
- A revalidating action returns the **re-rendered RSC in the same round-trip** — so on the client
  `await action()` does not resolve until the server has re-run `page.tsx` and streamed new data.

Net effect: an interactive mutation ("하자" commit, 참석 취소, program delete) shows **no change
at all** until the full DB-write + full-page-refetch round-trip completes. On the production stack
(Vercel dynamic RSC + Supabase pooler) that is ~1–2s, reported by the user as "반응성이 매우 느림".
The problem is *perceived* latency, not correctness — the write itself is fine.

## Decision

For hot, user-facing mutation paths, decouple perceived latency from the server round-trip with
**optimistic UI** (`useOptimistic` + `useTransition`), keeping `revalidatePath` as the source of
truth that reconciles in the background.

- **Timetable commit / uncommit** — optimistic in `TimetableCarousel`: apply the member's change
  and recompute the overlap band immediately, using the *same* domain function the server uses
  (`computeSuggestedTime`). The reducer is a pure, unit-tested module: `lib/timetable.ts`.
- **Program delete** (`SessionsView`) — optimistically drop the row (`pendingDeletes`) inside the
  transition; revalidation makes it permanent.
- **Shrink the action's own latency where free** — parallelize independent queries in `commit`
  with `Promise.all` (5 sequential round-trips → 3 waves). Independent reads/writes only; the
  dependency order (read-before-upsert, re-read-after-upsert) is preserved.

## Why

- **Optimistic UI is the right lever** because the bottleneck is perceived latency. Reusing the
  server's domain logic in the optimistic reducer means the local state matches what revalidation
  will produce, so there is no flash of divergence when the real props arrive.
- **Keep `revalidatePath`, don't replace the model.** It is the simplest correct invalidation;
  responsiveness is layered on top rather than trading away the RSC-as-source-of-truth design.
- **Parallelizing the action is a free real-latency win** that also shrinks the window in which
  optimistic and server state could differ.

## Consequences — and the deferred architectural work

The optimistic layer hides the cost; it does not remove it. The remaining structural improvements,
in rough priority:

1. **Granular cache tags.** `revalidatePath('/')` still refetches the entire page on every
   mutation. The real fix is `revalidateTag` + per-query `'use cache'`, so a commit re-fetches only
   the affected date instead of the 3-month sweep + all sessions/programs. This is the highest-value
   next step and the natural successor to this ADR.
2. **page.tsx fetch waterfall.** Timetable day details are fetched per target date; a single
   batched query (or a flatter Promise tree) would cut revalidation cost directly.
3. **Cold start.** ~4.3s on the first production request (dynamic RSC + Supabase transaction
   pooler) — observed at Phase 2 ship.
4. **Pre-existing review candidates** (see the `phase2-perf-followup` memory): AppShell rebuilds
   `new Set(...)` every render (memoize); `toRecord` is O(sessions×items) (group into Maps);
   `getAvailabilityByDates` empty-branch cast omits the `id` PK (`$inferSelect` sweep).

Any **new** hot mutation path should follow the same optimistic pattern. `addTopic` and
`createProgram` are intentionally *not* optimistic yet — lower frequency, and `createProgram` needs
client-side `today` to place a new row in the right (upcoming vs past) bucket; revisit if they start
to feel slow.
