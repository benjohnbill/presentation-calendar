'use client'
import { useState } from 'react'
import type { ComponentType } from 'react'
import { useRouter } from 'next/navigation'
import { NamePicker, useIdentity } from './NamePicker'
import { MonthCalendar } from './MonthCalendar'
import { TimetableCarousel } from './TimetableCarousel'
import { SessionsView } from './SessionsView'
import { CalendarIcon, ClockIcon, CheckCircleIcon } from './icons'
import { applyAvailability, commit, uncommit, addTopic } from '../actions'
import type { MonthAnchor } from '@/lib/calendar'
import { buildColorMap } from '@/lib/calendar'

type Member = { id: number; name: string }
type View = 'agree' | 'timetable' | 'sessions'

const NAV: { key: View; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { key: 'agree', label: '잠정결론 맞추기', Icon: CalendarIcon },
  { key: 'timetable', label: '시간표', Icon: ClockIcon },
  { key: 'sessions', label: '다가오는 세션', Icon: CheckCircleIcon },
]

export function AppShell(props: {
  members: Member[]
  monthAnchors: MonthAnchor[]
  today: string
  availByDate: Record<string, number[]>
  sessionDates: string[]
  openDate: string | null
  timetableDays: {
    date: string
    comm: { memberId: number; timeStart: string | null; timeEnd: string | null }[]
    tops: { presenterId: number; text: string }[]
    suggested: { start: string; end: string } | null
  }[]
  upcoming: { date: string }[]
  past: { date: string }[]
}) {
  const router = useRouter()
  const { id: myId, ready, pick } = useIdentity()
  const [view, setView] = useState<View>('agree')
  const [monthIdx, setMonthIdx] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)

  const colorMap = buildColorMap(props.members.map((m) => m.id))
  const sessionSet = new Set(props.sessionDates)
  const myName = props.members.find((m) => m.id === myId)?.name

  // Until localStorage is read, render a neutral splash so returning users
  // don't see the identity gate flash before their saved name loads.
  if (!ready) {
    return <div className="min-h-[100dvh] bg-[var(--background)]" />
  }

  // identity gate
  if (myId === null) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--background)] p-6">
        <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold tracking-tight">발표 캘린더</h1>
          <p className="mb-4 mt-1 text-sm text-stone-500">누구세요? 이름을 골라주세요.</p>
          <div className="flex flex-wrap justify-center">
            <NamePicker members={props.members} value={null} onPick={pick} />
          </div>
        </div>
      </div>
    )
  }

  const goTimetable = (date: string) => {
    router.push(`/?date=${date}`)
    setView('timetable')
  }

  const content = (
    <>
      {view === 'agree' && (
        <MonthCalendar
          anchor={props.monthAnchors[monthIdx]}
          today={props.today}
          availByDate={props.availByDate}
          members={props.members}
          colorMap={colorMap}
          sessionDates={sessionSet}
          myId={myId}
          onApply={async (adds, removes) => {
            // revalidatePath('/') inside the action refreshes the RSC; no router.refresh needed.
            await applyAvailability(myId, adds, removes)
          }}
          onOpenTimetable={goTimetable}
          canPrev={monthIdx > 0}
          canNext={monthIdx < props.monthAnchors.length - 1}
          onPrev={() => setMonthIdx((i) => Math.max(0, i - 1))}
          onNext={() => setMonthIdx((i) => Math.min(props.monthAnchors.length - 1, i + 1))}
        />
      )}

      {view === 'timetable' && (
        <TimetableCarousel
          key={props.openDate ?? 'first'}
          days={props.timetableDays}
          members={props.members}
          myId={myId}
          initialDate={props.openDate}
          onCommit={async (date, w) => {
            await commit(myId, date, w) // revalidatePath in the action refreshes the RSC
          }}
          onUncommit={async (date) => {
            await uncommit(myId, date)
          }}
          onAddTopic={async (date, t) => {
            await addTopic(myId, date, t)
          }}
          onGoCalendar={() => setView('agree')}
        />
      )}

      {view === 'sessions' && <SessionsView upcoming={props.upcoming} past={props.past} />}
    </>
  )

  return (
    <div className="flex h-[100dvh] flex-col bg-[var(--background)] lg:flex-row">
      {/* PC sidebar */}
      <nav className="hidden shrink-0 flex-col border-r border-stone-200 bg-white/70 px-3 py-5 lg:flex lg:w-60">
        <div className="px-2 pb-6">
          <h1 className="text-lg font-bold tracking-tight">발표 캘린더</h1>
          <p className="mt-0.5 text-xs text-stone-400">4명이면 세션이 떠요</p>
        </div>
        <div className="flex flex-col gap-1">
          {NAV.map((item) => (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                view === item.key ? 'bg-orange-50 text-orange-700' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <item.Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-auto">
          <IdentityControl
            myName={myName}
            members={props.members}
            myId={myId}
            pick={pick}
            open={pickerOpen}
            setOpen={setPickerOpen}
          />
        </div>
      </nav>

      {/* mobile top bar */}
      <header className="flex items-center justify-between border-b border-stone-200 bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
        <h1 className="text-base font-bold tracking-tight">발표 캘린더</h1>
        <IdentityControl
          myName={myName}
          members={props.members}
          myId={myId}
          pick={pick}
          open={pickerOpen}
          setOpen={setPickerOpen}
          compact
        />
      </header>

      {/* main content */}
      <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{content}</main>

      {/* mobile bottom tab bar */}
      <nav className="grid grid-cols-3 border-t border-stone-200 bg-white/90 backdrop-blur lg:hidden">
        {NAV.map((item) => (
          <button
            key={item.key}
            onClick={() => setView(item.key)}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
              view === item.key ? 'text-orange-600' : 'text-stone-400'
            }`}
          >
            <item.Icon className="h-5 w-5" />
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

function IdentityControl({
  myName, members, myId, pick, open, setOpen, compact,
}: {
  myName?: string
  members: Member[]
  myId: number | null
  pick: (id: number) => void
  open: boolean
  setOpen: (v: boolean) => void
  compact?: boolean
}) {
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 ${
          compact ? '' : 'w-full justify-center'
        }`}
      >
        <span className="text-stone-400">나:</span> {myName ?? '?'} <span className="text-xs text-stone-400">▾</span>
      </button>
      {open && (
        <div
          className={`absolute z-10 rounded-xl border border-stone-200 bg-white p-3 shadow-lg ${
            compact ? 'right-0 top-full mt-2 w-56' : 'bottom-full left-0 mb-2 w-full'
          }`}
        >
          <p className="mb-2 text-xs text-stone-400">이름 바꾸기</p>
          <div className="flex flex-wrap gap-1.5">
            <NamePicker
              members={members}
              value={myId}
              onPick={(id) => {
                pick(id)
                setOpen(false)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
