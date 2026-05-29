import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { existsSync, renameSync } from "fs"

export function init(path: string) {
  try {
    const sqlite = new Database(path, { create: true })
    const db = drizzle({ client: sqlite })
    return db
  } catch (err) {
    // Corrupted DB or inaccessible path — quarantine and recreate
    try {
      if (existsSync(path)) renameSync(path, path + ".corrupted")
      const sqlite = new Database(path, { create: true })
      return drizzle({ client: sqlite })
    } catch (fallbackErr) {
      // Even recreation failed — throw original error
      throw err
    }
  }
}

import crypto from "node:crypto"

export function applyMigrations(db: any, entries: any[]) {
  const migrations = entries.map((entry) => {
    const sqlStatements = entry.sql
      .split("--> statement-breakpoint")
      .map((it: string) => it.trim())
      .filter(Boolean)
    const hash = crypto.createHash("sha256").update(entry.sql).digest("hex")
    return {
      sql: sqlStatements,
      bps: true,
      folderMillis: entry.timestamp,
      hash,
      name: entry.name,
    }
  })
  db.dialect.migrate(migrations, db.session)
}

