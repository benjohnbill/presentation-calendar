# Presentation Calendar

A web app where a small group of friends mark which future dates they can attend a study-cafe
presentation session. A date provisionally establishes once enough people mark it as available,
and a Session is created once enough of them commit. There is no fixed cycle; the calendar runs
continuously and the group meets whenever a date gathers enough people.

Two chat platforms, cleanly split: **Discord** is where the machine talks — automated
notifications, mentions, reminders; the only platform the app integrates with. **KakaoTalk**
is where the humans talk — chatter, rough time-tweaking after a session is created, the final
conversation channel — and it also carries the pinned link, but has zero automation.

## Language

**Session (발표 세션)**:
The core gathering: a presentation session at the fixed study cafe where members present
prepared material — and, in the app, the object created when a date gathers enough commits.
The default and by far the most frequent mode (≈8 months of regular use). The whole
availability → commit → time flow exists to schedule these. Presentations only — non-
presentation activities are a separate concept (see Program).
_Avoid_: Meetup, event

**Topic (발표자/주제)**:
A rough, optional note within a Session of who plans to present and on what. 0..N per Session,
filled in during the flow so others can weigh what they are committing to. Pure context —
non-gating, and tracks no turns or rotation.
_Avoid_: Agenda, program (Program is the separate activity concept)

**Presenter (발표자)**:
A member who presents at a Session. No fixed turns or rotation — decided by feel on the day.
Attendance does not require presenting (listening-only is fine), though regulars usually bring
something.
_Avoid_: Speaker, host (Host is the Program role)

**Program (프로그램)**:
A separate, *host-driven, non-presentation* activity event — movie night, TRPG, board games,
drinks. One member (the Host) decides on it for a date and recruits others via a Discord
webhook. Rare (≈2× in 8 months); on a Program day the group does only that, no presentations.
Distinct logic from a Session — simpler, host-led scheduling (details TBD), and the recruitment
notification belongs here, not to Sessions.
_Avoid_: Session (a Program is not a presentation session), event

**Host (주최자)**:
The member who proposes, runs, and recruits for a Program. The Program analogue of a Presenter,
but for activities — and, unlike anything in a Session, actually sets the event up.
_Avoid_: Organizer (Sessions have no organizer; Host applies only to Programs)

**Open Calendar**:
The always-running, forward-looking calendar that members mark availability on. Not divided
into rounds or cycles — it runs continuously and its link is permanently pinned in the group's
Discord.
_Avoid_: Poll, vote (those imply a bounded round with a deadline)

**Available (가능)**:
A member's *date-level* mark that they can attend on a given date — capability only, no time
attached. The first-stage signal, set on the main Open Calendar. Drives Provisional Establish.
_Avoid_: Vote, RSVP, attending

**Commit (참석 의사 / 하자)**:
A member's second-stage mark that they *will* attend a provisionally-established date, carrying
a *time window* the member enters freely — any range they want, or "anytime". (A 7pm-onwards
preset may be offered for convenience, since that is the group's tradition, but it is never a
forced default — members type whatever range suits them.) Made on that date's per-day Timetable.
Distinct from Available: capability vs. will. 4 Commits → Session Created. The act of leaving a
time entry on the timetable *is* the commit.
_Avoid_: Confirm (the date-level event is Session Created; commit is the member's act)

**Timetable**:
The per-day, single-date view that opens on a provisionally-established date. Laid out as one
**column per member** with a **vertical time axis**; each member's available time window is a
bar inside their own column, so overlaps are read across a horizontal time row. Exists only
after Provisional Establish — time coordination is deferred until a date has traction.
_Avoid_: Grid, when2meet (it is one day only, not a date × time matrix)

**Suggested Time (추천 시간 / 겹침 시간대)**:
A time row on the Timetable where the overlap reaches the threshold (≥4 members available at
that time), highlighted automatically. It is a *suggestion of the best meeting time*, NOT a
condition for Session Created — purely informational, sits on top of the already-made date
decision. May not exist if members' times never overlap enough.
_Avoid_: Confirmed time, locked time (the time is never locked by the system; humans finalize)

**Provisional Establish (잠정 성립)**:
The automatic state a date enters the moment enough members mark Available (the availability
threshold, currently 4). Detected by the system, not yet committed. Triggers a notification
and opens the date for Commit. May break again if a member withdraws their availability.
_Avoid_: Confirmed, established (those imply commitment)

**Session Created (세션 생성 / 성사)**:
The event — and resulting state — when a provisionally-established date reaches 4 Commits and a
Session comes into existence. Emergent from consensus: no single person "presses confirm"; the
system creates the Session and notifies when the commit threshold is met. The deliberate beat
that prevents a date from becoming real too hastily. "성사" is the group's own pre-existing word
for this; treat it as a synonym.
_Avoid_: Confirm, 확정 (retired — "확정" read as too final/locked for what is really the
creation of a still-being-planned session)

**Threshold**:
A minimum count, fixed at **4** for both stages: the *availability threshold* (members marked
Available → Provisional Establish) and the *commit threshold* (members who Commit → Session
Created). The number 4 is not arbitrary — it is the group's long-standing rule ("4명 모이면
성사"), agreed among the friends before the app existed. Commit ⊆ Available (you can only Commit
to a date you marked Available).
_Avoid_: Quorum, minimum

**Member**:
One of the friends in the group. Identified by picking their name from the Roster — there is
no login. Distinctness of members is honor-system, acceptable for a closed friend group.
_Avoid_: User, account, voter

**Roster**:
The fixed list of members. Each entry is a name (which the member picks to identify themselves,
no login) plus that member's Discord user ID, filled in once by hand so the app can target
Discord mentions at exactly the relevant people. Closed set (the friend group), not open
self-signup.
_Avoid_: User list, members table

_No Organizer role (with one deliberate asymmetry)._ An earlier design had one member "press
confirm"; that was dissolved. Session Created is emergent from collective Commit, so there is
intentionally no privileged role. Anyone Available can Commit; the Session is created when the
commit threshold is met. The asymmetry: the *additive* flow (availability → commit → creation)
is low-risk and needs no role, but *destructive* actions — cancelling a created Session — are
gated to a single **Admin** account. That Admin (and any cancellation) is a Phase 2 feature;
MVP has neither.
