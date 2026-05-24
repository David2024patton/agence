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
