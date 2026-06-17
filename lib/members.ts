// Order members with the current user first (left-most / front), keeping the
// rest in their original order. Used by the timetable columns and the session
// presenter picker so "내 이름" always reads first. Pure; Array.sort is stable
// (ES2019+), so non-self members keep their incoming order.
export function selfFirst<T extends { id: number }>(members: T[], myId: number): T[] {
  return [...members].sort((a, b) => (a.id === myId ? 0 : 1) - (b.id === myId ? 0 : 1))
}
