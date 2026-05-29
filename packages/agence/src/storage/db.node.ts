import { DatabaseSync } from "node:sqlite"
import { drizzle } from "drizzle-orm/node-sqlite"
import { existsSync, renameSync } from "fs"

export function init(path: string) {
  try {
    const sqlite = new DatabaseSync(path)
    const db = drizzle({ client: sqlite })
    return db
  } catch (err) {
    // Corrupted DB or inaccessible path — quarantine and recreate
    try {
      if (existsSync(path)) renameSync(path, path + ".corrupted")
      const sqlite = new DatabaseSync(path)
      return drizzle({ client: sqlite })
    } catch (fallbackErr) {
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

