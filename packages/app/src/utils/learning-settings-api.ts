import { parseHeartbeatTasks, enrichHeartbeatTasks } from "@/utils/heartbeat-md"

type LearningHttp = <T>(input: { method: "GET" | "POST"; path: string; body?: unknown }) => Promise<T>

export type KnowledgeSettingsState = {
  path: string
  exists: boolean
  articleCount: number
  files: { name: string; links: string[] }[]
}

export type HeartbeatSettingsState = {
  path: string
  exists: boolean
  content: string
  tasks: {
    enabled: boolean
    interval: string
    taskName: string
    prompt: string
    lastRun?: number
    nextRunInMs?: number
  }[]
}

type LibraryListResponse = {
  path: string
  files: { name: string; links: string[] }[]
}

type FileContentResponse = {
  content?: string
  path?: string
}

const heartbeatStatePaths = ["/library/heartbeat/state", "/heartbeat/state"] as const
const heartbeatSavePaths = ["/library/heartbeat/save", "/heartbeat/save"] as const
const heartbeatInitPaths = ["/library/heartbeat/init", "/heartbeat/init"] as const

async function tryPaths<T>(
  http: LearningHttp,
  paths: readonly string[],
  input: { method: "GET" | "POST"; body?: unknown },
) {
  let last: unknown
  for (const path of paths) {
    try {
      return await http<T>({ method: input.method, path, body: input.body })
    } catch (error) {
      last = error
      const message = error instanceof Error ? error.message : String(error)
      if (!message.includes("HTML instead of JSON") && !message.startsWith("HTTP 404")) continue
    }
  }
  throw last instanceof Error ? last : new Error(String(last))
}

const PROJECT_WIKI_REL = ".agence/knowledge/wiki"

function displayKnowledgePath(raw: string) {
  const normalized = raw.replace(/\\/g, "/")
  if (normalized.includes(".agence/knowledge/wiki")) return PROJECT_WIKI_REL
  if (normalized.endsWith("/.agence/knowledge") || normalized.endsWith("/knowledge")) return PROJECT_WIKI_REL
  if (normalized.startsWith(".agence/")) return normalized
  return PROJECT_WIKI_REL
}

export async function fetchKnowledgeSettingsState(http: LearningHttp): Promise<KnowledgeSettingsState> {
  try {
    const state = await http<KnowledgeSettingsState & { pathAbsolute?: string }>({
      method: "GET",
      path: "/knowledge/state",
    })
    return { ...state, path: displayKnowledgePath(state.path) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const retry =
      message.includes("HTML instead of JSON") ||
      message.startsWith("HTTP 404") ||
      message.startsWith("HTTP 500")
    if (!retry) throw error
  }

  const listed = await http<LibraryListResponse>({ method: "GET", path: "/library/list" })
  return {
    path: displayKnowledgePath(listed.path),
    exists: listed.files.length > 0,
    articleCount: listed.files.length,
    files: listed.files.map((file) => ({ name: file.name, links: file.links })),
  }
}

async function fetchHeartbeatFromFile(
  http: LearningHttp,
  directory: string,
): Promise<HeartbeatSettingsState> {
  const path = "HEARTBEAT.md"
  let content = ""
  let exists = false
  try {
    const file = await http<FileContentResponse>({
      method: "GET",
      path: `/file/content?path=${encodeURIComponent(path)}`,
    })
    content = file.content ?? ""
    exists = true
  } catch {
    exists = false
  }

  const runs = await http<FileContentResponse>({
    method: "GET",
    path: `/file/content?path=${encodeURIComponent(".agence/heartbeat.json")}`,
  })
    .then((file) => {
      try {
        return JSON.parse(file.content ?? "{}") as Record<string, number>
      } catch {
        return {}
      }
    })
    .catch(() => ({}) as Record<string, number>)

  const tasks = enrichHeartbeatTasks(parseHeartbeatTasks(content), runs)
  return {
    path: "HEARTBEAT.md",
    exists,
    content,
    tasks,
  }
}

export async function fetchHeartbeatSettingsState(
  http: LearningHttp,
  directory: string,
): Promise<HeartbeatSettingsState> {
  try {
    return await tryPaths<HeartbeatSettingsState>(http, heartbeatStatePaths, { method: "GET" })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes("HTML instead of JSON") && !message.startsWith("HTTP 404")) throw error
    return fetchHeartbeatFromFile(http, directory)
  }
}

export async function saveHeartbeatSettingsState(
  http: LearningHttp,
  body: {
    tasks: readonly { enabled: boolean; interval: string; taskName: string; prompt: string }[]
    preamble?: string
  },
) {
  try {
    return await tryPaths<HeartbeatSettingsState>(http, heartbeatSavePaths, { method: "POST", body })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes("HTML instead of JSON")) {
      throw new Error(
        "Heartbeat editing needs a newer Agence sidecar. Quit the app, run `bun dev:desktop` from the repo (or install v1.16.5+), then try again.",
      )
    }
    throw error
  }
}

export async function initHeartbeatSettingsState(http: LearningHttp) {
  return tryPaths<HeartbeatSettingsState>(http, heartbeatInitPaths, { method: "POST" })
}

export type SkillOptOverview = {
  settings: {
    enabled?: boolean
    autoAfterSession?: boolean
    maxEditChars?: number
    maxEditsPerCycle?: number
    minSessionMessages?: number
  }
  state: {
    rejected: { skill: string; edits: unknown[]; reason: string; at: number }[]
    accepted: { skill: string; summary: string; at: number }[]
    skills: Record<string, { version: number; path: string; hash: string }>
  }
  skills: { name: string; path: string; version: number; hash?: string }[]
  acceptedCount: number
  rejectedCount: number
}

export async function fetchSkillOptState(http: LearningHttp) {
  return http<SkillOptOverview>({ method: "GET", path: "/skill-opt/state" })
}

export async function saveSkillOptSettings(http: LearningHttp, settings: SkillOptOverview["settings"]) {
  return http<SkillOptOverview["settings"]>({ method: "POST", path: "/skill-opt/settings", body: settings })
}

export async function runSkillOpt(http: LearningHttp) {
  return http<{ optimized: number; rejected: number; sessionID?: string }>({ method: "POST", path: "/skill-opt/run" })
}
