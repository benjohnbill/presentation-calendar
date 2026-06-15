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
