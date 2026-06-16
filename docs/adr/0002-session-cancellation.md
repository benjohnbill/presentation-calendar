# 0002 — Admin-gated session cancellation that notifies and reverts

Status: accepted

## Context

A Session is sticky — `uncommit` never deletes it. So a created Session that dies socially
(everyone backs out in KakaoTalk) still sits in "다가오는 세션" and still fires its 9am
reminder, telling people to show up to something that is not happening. There needs to be a way
to cancel it. Two existing design facts pull against the obvious implementation: the system's
"붕괴는 알리지 않는다" principle (a provisional date silently un-establishes, no notification) and
honor-system identity (members pick a name, there is no login).

## Decision

Add a manual **cancel**, gated to the **Admin** (진근). Cancelling a Session:

1. **Notifies** the committers (targeted Discord mention) that the Session is cancelled.
2. **Reverts** the date rather than blocking it: delete the `sessions` row, the `commits`, and
   that date's `session_created` / `reminder` rows in `notifications`; keep `availabilities` and
   `topics`. The date falls back to the provisionally-established state (still ≥4 available, 0
   committed) and can reform into a fresh Session later.

Gating is honor-system (the cancel control shows only for the Admin identity) plus a
confirmation dialog. Roster management — nominally also the Admin's job — is deferred until the
group grows.

## Why

- **Cancel notifies, even though collapse is silent.** Silent collapse applies to a *provisional*
  date — not yet a promise, so un-establishing it is noise. A *created* Session is an announced
  commitment; cancelling it silently would send someone to an empty cafe. Here notification is
  safety, not noise. This is the deliberate exception a reader would otherwise mistake for a bug.
- **Revert, not soft-cancel.** The Open Calendar is continuous with no rounds; a date is never
  "cursed." A failed attempt should free the date to be re-coordinated, not blocked behind a
  `cancelled` flag. Reverting also avoids carrying extra session state.
- **Honor-system gating, not real auth.** Identity is already honor-system; adding a PIN/login for
  one action breaks the no-login simplicity. In a closed friend group the worst case (malicious
  cancel) is a social problem; the real risk (accidental cancel) is handled by a confirm dialog.

## Consequences

- The purge **must** clear the date's `session_created` / `reminder` notification rows, or the
  idempotent-notifications design (ADR 0001) would suppress the re-notification when the date
  reforms.
- Cancel clears `commits` (the commitments are void) but keeps `availabilities` (still true), so
  the date returns to *provisional*, not blank — the timetable stays open for an immediate retry.
- A cancelled Session leaves no history trace; it never happened, so it does not appear in past
  sessions.
