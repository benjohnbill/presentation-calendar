import type { DiscordMessage } from './messages'

export async function postToDiscord(msg: DiscordMessage): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL
  if (!url) throw new Error('DISCORD_WEBHOOK_URL not set')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(msg),
  })
  if (!res.ok) {
    throw new Error(`Discord webhook failed: ${res.status} ${await res.text()}`)
  }
}
