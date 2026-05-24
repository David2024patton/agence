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
