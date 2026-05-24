import { drizzle } from "drizzle-orm/node-sqlite/driver"
const m = await import("../packages/desktop/out/main/chunks/node-8Oc9paQj.js")

await m.Log.init({ level: "DEBUG" })

try {
  const client = m.Database.Client()
  console.log("DB opened, $client type:", typeof client.$client)
  const db = drizzle({ client: client.$client })
  console.log("drizzle wrapper OK")

  const result = await m.JsonMigration.run(db)
  console.log("Migration result:", JSON.stringify(result))
} catch (e) {
  console.log("Error:", e.message)
  console.log("Stack:", e.stack?.split("\n").slice(0, 5).join("\n"))
}
