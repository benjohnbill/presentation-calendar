// Shared physics for finger-following swipe pagers (calendar months, timetable
// days). Pages render side-by-side and the track follows the finger so the next
// page peeks in; on release it settles with an ease-out snap (Instagram-style).

export const SNAP_MS = 320
export const SNAP_EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)' // ease-out

// Decide which index to settle on after a drag, from travelled distance and
// flick velocity. A quick flick advances even if short; otherwise it needs to
// pass ~25% of the page width, else it snaps back.
export function settleIndex(index: number, count: number, dx: number, vx: number, width: number): number {
  const flick = Math.abs(vx) > 0.45 // px/ms
  const far = width > 0 && Math.abs(dx) > width * 0.25
  if (!flick && !far) return index
  if (dx < 0) return Math.min(count - 1, index + 1)
  if (dx > 0) return Math.max(0, index - 1)
  return index
}
