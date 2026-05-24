import { drizzle } from "drizzle-orm/node-sqlite/driver"
const m = await import("./dist/node/node.js")
await m.Log.init({ level: "DEBUG" })
try {
  const result = await m.JsonMigration.run(drizzle({ client: m.Database.Client().$client }))
  console.log("Migration OK:", JSON.stringify(result))
} catch (e) {
  console.log("Migration FAILED:", e.message)
  console.log(e.stack?.split("\n").slice(0, 3).join("\n"))
}
