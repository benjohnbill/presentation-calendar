// Minimal stroke icons for nav (reliable across fonts — no emoji dependency).
type P = { className?: string }
const base = 'h-5 w-5'

export function CalendarIcon({ className }: P) {
  return (
    <svg className={`${base} ${className ?? ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M3 9h18M8 3v3M16 3v3" />
    </svg>
  )
}

export function ClockIcon({ className }: P) {
  return (
    <svg className={`${base} ${className ?? ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

export function CheckCircleIcon({ className }: P) {
  return (
    <svg className={`${base} ${className ?? ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </svg>
  )
}
