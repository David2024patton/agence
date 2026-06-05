import { afterEach, describe, expect, test } from "bun:test"
import { Context } from "effect"
import { HttpApiApp } from "../../src/server/routes/instance/httpapi/server"
import * as Log from "@agence-ai/core/util/log"
import { resetDatabase } from "../fixture/db"
import { disposeAllInstances, tmpdir } from "../fixture/fixture"

void Log.init({ print: false })

const context = Context.empty() as Context.Context<unknown>

function request(directory: string) {
  const url = new URL("http://localhost/library/list")
  url.searchParams.set("directory", directory)
  return HttpApiApp.webHandler().handler(new Request(url, { method: "GET" }), context)
}

afterEach(async () => {
  await disposeAllInstances()
  await resetDatabase()
})

describe("library HttpApi", () => {
  test("GET /library/list returns wiki files for the project directory", async () => {
    await using tmp = await tmpdir({ git: true })

    const response = await request(tmp.path)
    expect(response.status).toBe(200)

    const body = (await response.json()) as { path: string; files: { name: string }[] }
    expect(body.path).toContain(".agence/knowledge/wiki")
    expect(body.files.length).toBeGreaterThan(0)
    expect(body.files.some((file) => file.name === "index.md")).toBe(true)
    expect("pathAbsolute" in body).toBe(false)
  })
})
