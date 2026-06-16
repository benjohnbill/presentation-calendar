export type DiscordMessage = {
  content: string
  allowed_mentions: { users: string[] }
}

const mentions = (ids: string[]) => ids.map((id) => `<@${id}>`).join(' ')

export function buildProvisional(a: { date: string; mentionIds: string[]; url: string }): DiscordMessage {
  return {
    content:
      `🔥 ${a.date} 잠정 성립 — 4명 가능!\n` +
      `시간표 열렸어요. 들어와서 가능 시간 남겨주세요. (4명 commit하면 세션 생성)\n` +
      `👉 ${a.url}\n${mentions(a.mentionIds)}`,
    allowed_mentions: { users: a.mentionIds },
  }
}

export function buildSessionCreated(a: {
  date: string
  lines: string[]
  suggested: { start: string; end: string } | null
  mentionIds: string[]
  url: string
}): DiscordMessage {
  const suggestedLine = a.suggested ? `\n✨ 다 겹치는 시간: ${a.suggested.start}~${a.suggested.end}` : ''
  return {
    content:
      `🎉 세션 생성! — ${a.date}\n` +
      `🕖 각자 가능 시간:\n` +
      a.lines.map((l) => ` · ${l}`).join('\n') +
      suggestedLine +
      `\n카톡에서 최종 시간 정하자! 🔗 ${a.url}\n${mentions(a.mentionIds)}`,
    allowed_mentions: { users: a.mentionIds },
  }
}

export function buildReminder(a: {
  date: string
  mentionIds: string[]
  url: string
  suggested: { start: string; end: string } | null
}): DiscordMessage {
  const timeLine = a.suggested
    ? `겹친 시간 ${a.suggested.start}~${a.suggested.end} — 최종은 카톡 확인.`
    : `시간은 카톡 확인.`
  return {
    content: `⏰ 오늘 ${a.date} 세션! ${timeLine}\n👉 ${a.url}\n${mentions(a.mentionIds)}`,
    allowed_mentions: { users: a.mentionIds },
  }
}

// Late join: a NEW member commits to an already-created session.
// Quiet by design — no pings (empty allowed_mentions). Shows the joiner, the new
// count, and the (possibly shifted) suggested time so people see the picture change.
export function buildLateJoin(a: {
  date: string
  joinerName: string
  count: number
  suggested: { start: string; end: string } | null
  url: string
}): DiscordMessage {
  const suggestedLine = a.suggested ? ` ✨ 겹치는 시간 갱신: ${a.suggested.start}~${a.suggested.end}` : ''
  return {
    content: `🙋 ${a.joinerName}도 합류 (이제 ${a.count}명).${suggestedLine}\n🔗 ${a.url}`,
    allowed_mentions: { users: [] },
  }
}
