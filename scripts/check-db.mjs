import { DatabaseSync } from "node:sqlite"
const db = new DatabaseSync("C:\\Users\\David\\.local\\share\\agence\\agence-dev.db")
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
console.log("Tables:", tables.map((t) => t.name).join(", "))
const accounts = db.prepare("SELECT COUNT(*) as c FROM account").get()
console.log("Accounts:", accounts.c)
const auths = db.prepare("SELECT COUNT(*) as c FROM auth").get()
console.log("Auths:", auths.c)
