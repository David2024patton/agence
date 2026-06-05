import path from "path"
import { AppFileSystem } from "@agence-ai/core/filesystem"
import { Effect, Schema, Types } from "effect"
import { MANIFEST_DIR, loadManifest, saveManifest } from "./manifest"

export const REGISTRY_VERSION = 1
export const REGISTRY_FILENAME = "registry.json"
export const INSTALLS_DIR = "installs"

export const ResourceType = Schema.Literals(["persona", "skill", "mcp", "plugin", "document_pack", "memory_pack"])
export type ResourceType = Schema.Schema.Type<typeof ResourceType>

export const ResourceRef = Schema.Struct({
  type: ResourceType,
  ref: Schema.String,
})
export type ResourceRef = Schema.Schema.Type<typeof ResourceRef>

export const ResourceEntry = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.String),
  enabled: Schema.optional(Schema.Boolean),
  source: Schema.optional(Schema.Literals(["builtin", "local", "github", "upload", "config"])),
  path: Schema.optional(Schema.String),
  github: Schema.optional(Schema.String),
})
export type ResourceEntry = Schema.Schema.Type<typeof ResourceEntry>

export const ResourceGroup = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.String),
  builtin: Schema.optional(Schema.Boolean),
  items: Schema.Array(ResourceRef),
})
export type ResourceGroup = Schema.Schema.Type<typeof ResourceGroup>

export const Registry = Schema.Struct({
  version: Schema.optional(Schema.Number),
  personas: Schema.optional(Schema.Array(ResourceEntry)),
  skills: Schema.optional(Schema.Array(ResourceEntry)),
  mcps: Schema.optional(Schema.Array(ResourceEntry)),
  plugins: Schema.optional(Schema.Array(ResourceEntry)),
  groups: Schema.optional(Schema.Array(ResourceGroup)),
})
export type Registry = Schema.Schema.Type<typeof Registry>

export function registryPath(directory: string) {
  return path.join(directory, MANIFEST_DIR, REGISTRY_FILENAME)
}

export function installsRoot(directory: string) {
  return path.join(directory, MANIFEST_DIR, INSTALLS_DIR)
}

export const BUILTIN_GROUPS: ResourceGroup[] = [
  {
    id: "default",
    name: "Default",
    description: "Core agent tools and project skills",
    builtin: true,
    items: [
      { type: "skill", ref: "agence" },
      { type: "persona", ref: "build" },
    ],
  },
  {
    id: "research",
    name: "Research",
    description: "Search, knowledge base, and memory recall",
    builtin: true,
    items: [
      { type: "skill", ref: "agence" },
      { type: "persona", ref: "build" },
    ],
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Read-only exploration",
    builtin: true,
    items: [{ type: "persona", ref: "explore" }],
  },
]

export const INSTALLED_GROUP_ID = "installed"

export function appendRefsToInstalledGroup(registry: Types.DeepMutable<Registry>, refs: ResourceRef[]) {
  if (refs.length === 0) return
  const groups = registry.groups ?? (registry.groups = [])
  let group = groups.find((item) => item.id === INSTALLED_GROUP_ID)
  if (!group) {
    group = {
      id: INSTALLED_GROUP_ID,
      name: "Installed",
      description: "Resources installed from GitHub or upload",
      items: [],
    }
    groups.push(group)
  }
  const seen = new Set(group.items.map((item) => `${item.type}:${item.ref}`))
  for (const ref of refs) {
    const key = `${ref.type}:${ref.ref}`
    if (seen.has(key)) continue
    group.items.push(ref)
    seen.add(key)
  }
}

export function removeRefFromInstalledGroup(registry: Types.DeepMutable<Registry>, ref: ResourceRef) {
  const group = registry.groups?.find((item) => item.id === INSTALLED_GROUP_ID)
  if (!group) return
  group.items = group.items.filter((item) => !(item.type === ref.type && item.ref === ref.ref))
}

export function replaceInstalledRefsOfType(registry: Types.DeepMutable<Registry>, type: ResourceType, refs: readonly string[]) {
  const groups = registry.groups ?? (registry.groups = [])
  let group = groups.find((item) => item.id === INSTALLED_GROUP_ID)
  if (!group) {
    group = {
      id: INSTALLED_GROUP_ID,
      name: "Installed",
      description: "Resources installed from GitHub or upload",
      items: [],
    }
    groups.push(group)
  }
  group.items = [
    ...group.items.filter((item) => item.type !== type),
    ...refs.map((ref) => ({ type, ref })),
  ]
}

export function refLockedInBuiltinEnabled(
  manifest: { enabled_groups?: readonly string[] },
  registry: Registry,
  type: ResourceType,
  ref: string,
) {
  if (!effectiveRefs(manifest, registry).some((item) => item.type === type && item.ref === ref)) return false
  if (registry.groups?.find((group) => group.id === INSTALLED_GROUP_ID)?.items.some((item) => item.type === type && item.ref === ref))
    return false
  const enabled = new Set(manifest.enabled_groups ?? ["default"])
  for (const group of allGroups(registry)) {
    if (!group.builtin || !enabled.has(group.id)) continue
    if (group.items.some((item) => item.type === type && item.ref === ref)) return true
  }
  return false
}

export function wireInstalledRefs(directory: string, refs: ResourceRef[]) {
  return Effect.gen(function* () {
    if (refs.length === 0) return
    const registry = yield* loadRegistry(directory)
    appendRefsToInstalledGroup(registry, refs)
    yield* saveRegistry(directory, registry)
    const manifest = yield* loadManifest(directory)
    const enabled = new Set(manifest.enabled_groups ?? ["default"])
    if (!enabled.has(INSTALLED_GROUP_ID)) {
      enabled.add(INSTALLED_GROUP_ID)
      yield* saveManifest(directory, { ...manifest, enabled_groups: [...enabled] })
    }
  })
}

function defaultRegistry(): Registry {
  return {
    version: REGISTRY_VERSION,
    personas: [],
    skills: [],
    mcps: [],
    plugins: [],
    groups: [],
  }
}

const decode = Schema.decodeUnknownSync(Registry)

export function loadRegistry(directory: string): Effect.Effect<Types.DeepMutable<Registry>, never, AppFileSystem.Service> {
  return Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    const file = registryPath(directory)
    if (!(yield* fs.existsSafe(file))) return defaultRegistry() as Types.DeepMutable<Registry>
    const raw = yield* fs.readFileString(file).pipe(Effect.catch(() => Effect.succeed("{}")))
    const parsed = yield* Effect.try({
      try: () => JSON.parse(raw) as unknown,
      catch: (error) => error,
    }).pipe(Effect.catch(() => Effect.succeed({} as unknown)))
    const decoded = yield* Effect.try({
      try: () => decode(parsed),
      catch: (error) => error,
    }).pipe(Effect.catch(() => Effect.succeed(defaultRegistry())))
    return { ...defaultRegistry(), ...decoded } as Types.DeepMutable<Registry>
  })
}

export function saveRegistry(directory: string, registry: Registry) {
  return Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    const file = registryPath(directory)
    yield* fs.writeWithDirs(file, JSON.stringify({ ...registry, version: REGISTRY_VERSION }, null, 2))
  })
}

export function ensureRegistry(directory: string) {
  return Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    const file = registryPath(directory)
    if (yield* fs.existsSafe(file)) return yield* loadRegistry(directory)
    const next = defaultRegistry()
    yield* saveRegistry(directory, next)
    return next
  })
}

export function allGroups(registry: Registry) {
  const custom = registry.groups ?? []
  const ids = new Set(custom.map((g) => g.id))
  return [...BUILTIN_GROUPS.filter((g) => !ids.has(g.id)), ...custom]
}

export function effectiveRefs(manifest: { enabled_groups?: readonly string[] }, registry: Registry) {
  const enabled = new Set(manifest.enabled_groups ?? ["default"])
  const refs: ResourceRef[] = []
  for (const group of allGroups(registry)) {
    if (!enabled.has(group.id)) continue
    refs.push(...group.items)
  }
  const seen = new Set<string>()
  return refs.filter((item) => {
    const key = `${item.type}:${item.ref}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function refsByType(refs: ResourceRef[], type: ResourceType) {
  return refs.filter((item) => item.type === type).map((item) => item.ref)
}

export function groupFilterSets(manifest: { enabled_groups?: readonly string[] }, registry: Registry) {
  const refs = effectiveRefs(manifest, registry)
  const skills = refsByType(refs, "skill")
  const mcps = refsByType(refs, "mcp")
  const personas = refsByType(refs, "persona")
  return {
    skills: skills.length ? new Set(skills) : undefined,
    mcps: mcps.length ? new Set(mcps) : undefined,
    personas: personas.length ? new Set(personas) : undefined,
  }
}

export function loadGroupFilter(directory: string) {
  return Effect.gen(function* () {
    const manifest = yield* loadManifest(directory).pipe(Effect.catch(() => Effect.succeed(undefined)))
    if (!manifest) return undefined
    const registry = yield* loadRegistry(directory).pipe(Effect.catch(() => Effect.succeed(defaultRegistry())))
    return groupFilterSets(manifest, registry)
  })
}

export * as ProjectRegistry from "./registry"
