import path from "path"
import { AppFileSystem } from "@agence-ai/core/filesystem"
import { Effect, Schema } from "effect"

export const MANIFEST_VERSION = 1
export const MANIFEST_FILENAME = "project.json"
export const MANIFEST_DIR = ".agence"

export const Manifest = Schema.Struct({
  version: Schema.optional(Schema.Number),
  persona_id: Schema.optional(Schema.String),
  default_model: Schema.optional(Schema.String),
  goal: Schema.optional(Schema.String),
  enabled_groups: Schema.optional(Schema.Array(Schema.String)),
  max_parallel_agents: Schema.optional(Schema.Number),
})
export type Manifest = Schema.Schema.Type<typeof Manifest>

export function manifestPath(directory: string) {
  return path.join(directory, MANIFEST_DIR, MANIFEST_FILENAME)
}

export function defaultManifest(): Manifest {
  return {
    version: MANIFEST_VERSION,
    enabled_groups: ["default"],
    max_parallel_agents: 3,
  }
}

const decode = Schema.decodeUnknownSync(Manifest)

export function loadManifest(directory: string) {
  return Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    const file = manifestPath(directory)
    if (!(yield* fs.existsSafe(file))) return defaultManifest()
    const raw = yield* fs.readFileString(file).pipe(Effect.catch(() => Effect.succeed("{}")))
    const parsed = JSON.parse(raw) as unknown
    return { ...defaultManifest(), ...decode(parsed) }
  })
}

export function saveManifest(directory: string, manifest: Manifest) {
  return Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    const file = manifestPath(directory)
    yield* fs.writeWithDirs(file, JSON.stringify({ ...manifest, version: MANIFEST_VERSION }, null, 2))
  })
}

export function ensureManifest(directory: string) {
  return Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    const file = manifestPath(directory)
    if (yield* fs.existsSafe(file)) return yield* loadManifest(directory)
    const next = defaultManifest()
    yield* saveManifest(directory, next)
    return next
  })
}

export * as ProjectManifest from "./manifest"
