import path from "path"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { AppFileSystem } from "@agence-ai/core/filesystem"
import { Global } from "@agence-ai/core/global"
import { Effect } from "effect"
import { manifestPath } from "./manifest"

export type ProjectIndexEntry = {
  directory: string
  name?: string
  lastSeenMs: number
}

type ProjectsIndex = {
  version: number
  projects: ProjectIndexEntry[]
}

const INDEX_VERSION = 1

export function projectsIndexPath() {
  return path.join(Global.Path.data, "projects-index.json")
}

function desktopStorePaths() {
  const appData = process.env.APPDATA ?? path.join(Global.Path.home, "AppData", "Roaming")
  const names = ["ai.agence.desktop.dev", "ai.agence.desktop.beta", "ai.agence.desktop", "ai.opencode.desktop.dev"]
  return names.map((name) => path.join(appData, name, "agence.global.dat"))
}

function readDesktopProjects(): ProjectIndexEntry[] {
  const now = Date.now()
  const out: ProjectIndexEntry[] = []
  for (const file of desktopStorePaths()) {
    if (!existsSync(file)) continue
    let text = ""
    try {
      text = readFileSync(file, "utf8")
    } catch {
      continue
    }
    const parsed = JSON.parse(text) as Record<string, unknown>
    const server = parsed["server.v3"] as
      | { projects?: Record<string, Array<{ worktree?: string }>> }
      | undefined
    if (!server?.projects) continue
    for (const list of Object.values(server.projects)) {
      if (!Array.isArray(list)) continue
      for (const item of list) {
        if (!item?.worktree) continue
        out.push({ directory: item.worktree, lastSeenMs: now })
      }
    }
  }
  return out
}

function normalizeIndex(raw: unknown): ProjectsIndex {
  if (!raw || typeof raw !== "object") return { version: INDEX_VERSION, projects: [] }
  const value = raw as ProjectsIndex
  if (!Array.isArray(value.projects)) return { version: INDEX_VERSION, projects: [] }
  return {
    version: INDEX_VERSION,
    projects: value.projects.filter((item) => typeof item.directory === "string"),
  }
}

function loadProjectsIndex(): ProjectsIndex {
  const file = projectsIndexPath()
  if (!existsSync(file)) return { version: INDEX_VERSION, projects: [] }
  return normalizeIndex(JSON.parse(readFileSync(file, "utf8")))
}

function saveProjectsIndex(index: ProjectsIndex) {
  const file = projectsIndexPath()
  const dir = path.dirname(file)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(file, JSON.stringify(index, null, 2))
}

export function registerProject(directory: string, name?: string) {
  return Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    const normalized = path.resolve(directory)
    if (!(yield* fs.existsSafe(normalized))) return
    const index = loadProjectsIndex()
    const now = Date.now()
    const existing = index.projects.find((item) => path.resolve(item.directory) === normalized)
    const entry: ProjectIndexEntry = {
      directory: normalized,
      name: name ?? existing?.name,
      lastSeenMs: now,
    }
    index.projects = [entry, ...index.projects.filter((item) => path.resolve(item.directory) !== normalized)]
    saveProjectsIndex(index)
  })
}

export function listKnownProjects() {
  const index = loadProjectsIndex()
  const merged = new Map<string, ProjectIndexEntry>()
  for (const item of [...readDesktopProjects(), ...index.projects]) {
    const key = path.resolve(item.directory)
    const hasHub = existsSync(manifestPath(key)) || existsSync(path.join(key, ".agence"))
    if (!hasHub) continue
    const prev = merged.get(key)
    merged.set(key, {
      directory: key,
      name: item.name ?? prev?.name,
      lastSeenMs: Math.max(item.lastSeenMs, prev?.lastSeenMs ?? 0),
    })
  }
  return [...merged.values()].sort((a, b) => b.lastSeenMs - a.lastSeenMs)
}

export function projectDisplayName(entry: ProjectIndexEntry) {
  if (entry.name?.trim()) return entry.name.trim()
  return path.basename(entry.directory)
}

export * as ProjectsIndex from "./projects-index"
