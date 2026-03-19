import "dotenv/config"
import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { Client } from "pg"

interface JournalEntry {
  idx: number
  when: number
  tag: string
}

interface JournalFile {
  entries: JournalEntry[]
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex")
}

async function loadJournalEntries(): Promise<JournalEntry[]> {
  const journalPath = path.resolve(process.cwd(), "shared/db/migrations/meta/_journal.json")
  const raw = await fs.readFile(journalPath, "utf8")
  const parsed = JSON.parse(raw) as JournalFile

  if (!Array.isArray(parsed.entries) || parsed.entries.length === 0) {
    throw new Error("Migration journal has no entries")
  }

  return parsed.entries
}

async function sqlFileHash(tag: string): Promise<string> {
  const sqlPath = path.resolve(process.cwd(), `shared/db/migrations/${tag}.sql`)
  const sql = await fs.readFile(sqlPath, "utf8")
  return sha256(sql)
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required")
  }

  const client = new Client({ connectionString: databaseUrl })
  await client.connect()

  try {
    await client.query("create schema if not exists drizzle")
    await client.query(`
      create table if not exists drizzle.__drizzle_migrations (
        id serial primary key,
        hash text not null,
        created_at bigint
      )
    `)

    const existingMigration = await client.query<{
      id: number
      hash: string
      created_at: string | null
    }>(
      `select id, hash, created_at
       from drizzle.__drizzle_migrations
       order by created_at desc nulls last
       limit 1`
    )

    const accountTable = await client.query<{ exists: boolean }>(
      "select to_regclass('public.account') is not null as exists"
    )

    const entries = await loadJournalEntries()
    const latest = entries.at(-1)

    if (!latest) {
      throw new Error("Could not determine latest migration entry")
    }

    const existing = existingMigration.rows[0]
    const existingCreatedAt = existing?.created_at ? Number(existing.created_at) : null

    if (!accountTable.rows[0]?.exists) {
      console.log("No existing schema detected. Nothing to baseline.")
      return
    }

    if (existingCreatedAt !== null && existingCreatedAt >= latest.when) {
      console.log(`Migration baseline already up to date (created_at=${existingCreatedAt}). Skipping.`)
      return
    }

    const hash = await sqlFileHash(latest.tag)
    await client.query(`insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)`, [
      hash,
      latest.when
    ])

    console.log(`Baseline inserted at ${latest.tag} (created_at=${latest.when}).`)
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error("Failed to baseline migrations:", error)
  process.exit(1)
})
