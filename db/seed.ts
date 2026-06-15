import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { db } from './client'
import { members } from './schema'

type RosterEntry = { name: string; discordId: string }

async function main() {
  const roster: RosterEntry[] = JSON.parse(readFileSync('seed/roster.json', 'utf8'))
  for (const m of roster) {
    await db.insert(members).values({ name: m.name, discordId: m.discordId }).onConflictDoNothing()
  }
  console.log(`Seeded ${roster.length} members`)
  process.exit(0)
}

main()
