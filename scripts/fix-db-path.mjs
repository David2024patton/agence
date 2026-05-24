import { DatabaseSync } from "node:sqlite"
const db = new DatabaseSync("C:\\Users\\David\\.local\\share\\agence\\agence-dev.db")

const oldPath = "C:\\Users\\David\\AI\\smart-hub\\opencode01"
const newPath = "C:\\Users\\David\\AI\\agence"

db.exec("BEGIN TRANSACTION")

const result = db.prepare("UPDATE project SET worktree = ? WHERE worktree = ?").run(newPath, oldPath)
console.log("Updated projects:", result.changes)

const sessResult = db.prepare("UPDATE session SET directory = ? WHERE directory = ?").run(newPath, oldPath)
console.log("Updated sessions:", sessResult.changes)

db.exec("COMMIT")

console.log("\nProjects after update:")
const ps = db.prepare("SELECT id, worktree FROM project").all()
for (const p of ps) {
  console.log("  Project:", p.id, p.worktree)
}
