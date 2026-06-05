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

export function tryRemapDriveLetter(directory: string): string | undefined {
  if (!directory) return undefined
  const match = directory.match(/^([a-zA-Z]):(.*)$/)
  if (!match) return undefined

  const originalDrive = match[1].toUpperCase()
  const pathPart = match[2]

  const driveLetters = ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"]
  for (const drive of driveLetters) {
    if (drive === originalDrive) continue
    const candidate = `${drive}:${pathPart}`
    try {
      if (existsSync(candidate)) {
        if (
          existsSync(path.join(candidate, ".agence")) ||
          existsSync(path.join(candidate, "agence.json")) ||
          existsSync(path.join(candidate, "package.json")) ||
          existsSync(path.join(candidate, ".git"))
        ) {
          return path.resolve(candidate)
        }
      }
    } catch {
      // Ignore
    }
  }
  return undefined
}

export function listKnownProjects() {
  const index = loadProjectsIndex()
  const merged = new Map<string, ProjectIndexEntry>()
  let indexChanged = false
  for (const item of [...readDesktopProjects(), ...index.projects]) {
    let key = path.resolve(item.directory)
    if (!existsSync(key)) {
      const remapped = tryRemapDriveLetter(key)
      if (remapped) {
        key = remapped
        indexChanged = true
        const idx = index.projects.findIndex((p) => path.resolve(p.directory) === path.resolve(item.directory))
        if (idx !== -1) {
          index.projects[idx].directory = remapped
        }
      }
    }
    const exists = existsSync(key)
    const hasHub = !exists || existsSync(manifestPath(key)) || existsSync(path.join(key, ".agence"))
    if (!hasHub) continue
    const prev = merged.get(key)
    merged.set(key, {
      directory: key,
      name: item.name ?? prev?.name,
      lastSeenMs: Math.max(item.lastSeenMs, prev?.lastSeenMs ?? 0),
    })
  }
  if (indexChanged) {
    try {
      saveProjectsIndex(index)
    } catch {
      // Ignore
    }
  }
  return [...merged.values()].sort((a, b) => b.lastSeenMs - a.lastSeenMs)
}

export function projectDisplayName(entry: ProjectIndexEntry) {
  if (entry.name?.trim()) return entry.name.trim()
  return path.basename(entry.directory)
}

export * as ProjectsIndex from "./projects-index"
