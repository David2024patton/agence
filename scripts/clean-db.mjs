import { DatabaseSync } from "node:sqlite"
const db = new DatabaseSync("C:\\Users\\David\\.local\\share\\agence\\agence-dev.db")

db.exec("BEGIN TRANSACTION")

// Remove stale project (H: drive that no longer exists)
db.prepare("DELETE FROM session WHERE project_id = ?").run("4b0ea68d7af9a6031a7ffda7ad66e0cb83315750")
db.prepare("DELETE FROM project WHERE id = ?").run("4b0ea68d7af9a6031a7ffda7ad66e0cb83315750")

// Delete global sessions from directories that don't exist anymore
const staleDirs = [
  "D:\\.trade", "D:\\.trade\\New_trade", "D:\\1", "D:\\Scrape\\Polymarket",
  "C:\\Users\\David\\AI",
]
for (const dir of staleDirs) {
  db.prepare("DELETE FROM session WHERE project_id = ? AND directory = ?").run("global", dir)
}

db.exec("COMMIT")

const sessions = db.prepare("SELECT COUNT(*) as c FROM session").get()
const projects = db.prepare("SELECT id, worktree FROM project").all()
console.log("Sessions:", sessions.c)
console.log("Projects:")
for (const p of projects) {
  const count = db.prepare("SELECT COUNT(*) as c FROM session WHERE project_id = ?").get(p.id)
  console.log("  ", p.worktree, "-", count.c, "sessions")
}
