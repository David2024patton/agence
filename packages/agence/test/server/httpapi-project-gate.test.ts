import { afterEach, describe, expect, test } from "bun:test"
import { Context } from "effect"
import path from "node:path"
import { SessionID } from "../../src/session/schema"
import { HttpApiApp } from "../../src/server/routes/instance/httpapi/server"
import * as Log from "@agence-ai/core/util/log"
import { resetDatabase } from "../fixture/db"
import { disposeAllInstances, tmpdir } from "../fixture/fixture"

void Log.init({ print: false })

const context = Context.empty() as Context.Context<unknown>
const handler = () => HttpApiApp.webHandler().handler

const projectRequiredMessage =
  "Open a project in Agence before using the agent, skills, MCPs, or personas."

type GateCase = {
  name: string
  path: string
  field: string
  method?: "GET" | "POST"
  body?: unknown
}

const gatedRoutes: GateCase[] = [
  // Session / chat
  { name: "v1 session list", path: "/session", field: "directory" },
  { name: "v1 session status", path: "/session/status", field: "directory" },
  { name: "v1 session create", path: "/session", field: "directory", method: "POST", body: {} },
  { name: "v2 session list", path: "/api/session", field: "directory" },
  {
    name: "v2 session messages",
    path: `/api/session/${SessionID.descending()}/message`,
    field: "directory",
  },
  {
    name: "v2 session context",
    path: `/api/session/${SessionID.descending()}/context`,
    field: "directory",
  },
  {
    name: "v2 session prompt",
    path: `/api/session/${SessionID.descending()}/prompt`,
    field: "directory",
    method: "POST",
    body: { prompt: { type: "text", text: "hi" } },
  },
  // Project hub
  { name: "hub state", path: "/hub/state", field: "directory" },
  {
    name: "hub manifest update",
    path: "/hub/manifest",
    field: "directory",
    method: "POST",
    body: { goal: "test" },
  },
  {
    name: "hub upload",
    path: "/hub/upload",
    field: "directory",
    method: "POST",
    body: { type: "skill", name: "x", content: "---\nname: x\n---\n" },
  },
  {
    name: "hub groups toggle",
    path: "/hub/groups/toggle",
    field: "directory",
    method: "POST",
    body: { groupID: "default", enabled: true },
  },
  // Learning / memory / knowledge
  { name: "memory state", path: "/memory/state", field: "directory" },
  { name: "memory list", path: "/memory/list", field: "directory" },
  {
    name: "memory settings",
    path: "/memory/settings",
    field: "directory",
    method: "POST",
    body: { autoCapture: true },
  },
  {
    name: "memory delete",
    path: "/memory/delete",
    field: "directory",
    method: "POST",
    body: { ids: [] },
  },
  { name: "knowledge state", path: "/knowledge/state", field: "directory" },
  { name: "knowledge list", path: "/knowledge/list", field: "directory" },
  { name: "heartbeat state", path: "/heartbeat/state", field: "directory" },
  {
    name: "heartbeat init",
    path: "/heartbeat/init",
    field: "directory",
    method: "POST",
  },
  { name: "library list", path: "/library/list", field: "directory" },
  { name: "library heartbeat state", path: "/library/heartbeat/state", field: "directory" },
  { name: "skill-opt state", path: "/skill-opt/state", field: "directory" },
  {
    name: "skill-opt run",
    path: "/skill-opt/run",
    field: "directory",
    method: "POST",
  },
  // Agent runtime / tools
  { name: "mcp list", path: "/mcp", field: "directory" },
  { name: "config get", path: "/config", field: "directory" },
  { name: "agent list", path: "/agent", field: "directory" },
  { name: "skill list", path: "/skill", field: "directory" },
  { name: "instance path", path: "/path", field: "directory" },
  { name: "file list", path: "/file", field: "directory" },
  {
    name: "sync history",
    path: "/sync/history",
    field: "directory",
    method: "POST",
    body: {},
  },
  // v2 catalog
  { name: "v2 model list", path: "/api/model", field: "location[directory]" },
  { name: "v2 provider list", path: "/api/provider", field: "location[directory]" },
]

async function request(input: { path: string; method?: "GET" | "POST"; body?: unknown; directory?: string }) {
  const url = new URL(`http://localhost${input.path}`)
  if (input.directory !== undefined) url.searchParams.set("directory", input.directory)
  const init: RequestInit = { method: input.method ?? "GET" }
  if (input.body !== undefined) {
    init.headers = { "content-type": "application/json" }
    init.body = JSON.stringify(input.body)
  }
  return handler()(new Request(url, init), context)
}

async function parseError(response: Response) {
  expect(response.headers.get("content-type") ?? "").toContain("application/json")
  return response.json() as Promise<{
    _tag: string
    message: string
    kind?: string
    field?: string
  }>
}

afterEach(async () => {
  await disposeAllInstances()
  await resetDatabase()
})

describe("HttpApi project gate", () => {
  for (const route of gatedRoutes) {
    test(`${route.name} rejects missing directory with 400`, async () => {
      const response = await request({ path: route.path, method: route.method, body: route.body })
      expect(response.status).toBe(400)
      expect(await parseError(response)).toEqual({
        _tag: "InvalidRequestError",
        message: projectRequiredMessage,
        kind: "Query",
        field: route.field,
      })
    })
  }

  test("monitor state stays available without a project directory", async () => {
    const response = await request({ path: "/monitor/state" })
    expect(response.status).toBe(200)
    const body = (await response.json()) as { server: { healthy: boolean } }
    expect(body.server.healthy).toBe(true)
  })

  test("rejects a missing project path", async () => {
    const missing = path.join(process.cwd(), `.agence-missing-${Date.now()}`)
    const response = await request({ path: "/session", directory: missing })
    expect(response.status).toBe(400)
    expect(await parseError(response)).toMatchObject({
      _tag: "InvalidRequestError",
      message: "Project directory not found.",
      kind: "Query",
      field: "directory",
    })
  })

  test("accepts a valid project directory", async () => {
    await using tmp = await tmpdir({ git: true })

    const response = await request({ path: "/library/list", directory: tmp.path })
    expect(response.status).toBe(200)

    const body = (await response.json()) as { path: string; files: { name: string }[] }
    expect(body.path).toContain(".agence/knowledge/wiki")
    expect(body.files.some((file) => file.name === "index.md")).toBe(true)
  })

  test("v2 session list accepts a valid project directory", async () => {
    await using tmp = await tmpdir({ git: true })

    const response = await request({ path: "/api/session", directory: tmp.path })
    expect(response.status).toBe(200)

    const body = (await response.json()) as { items: unknown[]; cursor: { previous?: string; next?: string } }
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.cursor).toBeTypeOf("object")
  })

  test("hub skill install returns SkillInstallError for invalid github ref", async () => {
    await using tmp = await tmpdir({ git: true })

    const response = await request({
      path: "/hub/install/github",
      method: "POST",
      directory: tmp.path,
      body: { type: "skill", github: "not-valid" },
    })
    expect(response.status).toBe(400)
    const error = await parseError(response)
    expect(error._tag).toBe("SkillInstallError")
    expect(error.message).toContain("Invalid GitHub ref")
  })
})
