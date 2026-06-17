// Optimistic timetable updates. When a member taps "하자 (참석)" / "시간 수정" /
// "참석 취소", we apply the change to the local day data and recompute the
// overlap band immediately, so the UI responds instantly while the server
// action + revalidation complete in the background. Pure; reuses the same
// domain logic the server uses to compute the suggested time.
import { computeSuggestedTime } from '@/domain/suggestedTime'
import { THRESHOLD } from '@/domain/thresholds'

export type CommitRow = { memberId: number; timeStart: string | null; timeEnd: string | null }
export type TopicRow = { presenterId: number; text: string }
export type TimetableDay = {
  date: string
  comm: CommitRow[]
  tops: TopicRow[]
  suggested: { start: string; end: string } | null
}

export type OptimisticAction =
  | { type: 'commit'; date: string; memberId: number; window: { start: string | null; end: string | null } }
  | { type: 'uncommit'; date: string; memberId: number }

const recompute = (comm: CommitRow[]) =>
  computeSuggestedTime(
    comm.map((c) => ({ start: c.timeStart, end: c.timeEnd })),
    THRESHOLD,
  )

// Reducer for useOptimistic: returns a new days array with the action applied
// to its matching day (and only that day). Display reads commits by id, so the
// row order within `comm` is irrelevant.
export function applyOptimistic(days: TimetableDay[], action: OptimisticAction): TimetableDay[] {
  return days.map((day) => {
    if (day.date !== action.date) return day
    const others = day.comm.filter((c) => c.memberId !== action.memberId)
    const comm =
      action.type === 'commit'
        ? [...others, { memberId: action.memberId, timeStart: action.window.start, timeEnd: action.window.end }]
        : others
    return { ...day, comm, suggested: recompute(comm) }
  })
}
