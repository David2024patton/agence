import matter from "gray-matter"
import path from "path"
import { Effect } from "effect"
import type { Info as ConfigInfo } from "@/config/config"
import { Config } from "@/config/config"
import { Agent } from "@/agent/agent"
import { Skill } from "@/skill"
import { MCP } from "@/mcp"
import { Session } from "@/session/session"
import { AppFileSystem } from "@agence-ai/core/filesystem"
import { InstanceStore } from "./instance-store"
import { ensureManifest, loadManifest, saveManifest, type Manifest } from "./manifest"
import {
  allGroups,
  effectiveRefs,
  ensureRegistry,
  loadRegistry,
  refLockedInBuiltinEnabled,
  removeRefFromInstalledGroup,
  replaceInstalledRefsOfType,
  saveRegistry,
  wireInstalledRefs,
  appendRefsToInstalledGroup,
  refsByType,
  INSTALLED_GROUP_ID,
  type Registry,
  type ResourceGroup,
  type ResourceRef,
} from "./registry"
import { installFromGithub, SkillInstallError, type InstallInput } from "./installer"
import { loadPersonaContent, personaFilePath, savePersona } from "./persona"

const SUPPORTED_UPLOAD_TYPES = new Set<InstallInput["type"]>(["persona", "skill", "mcp", "plugin"])

function refreshProjectInstance(directory: string) {
  return Effect.gen(function* () {
    const store = yield* InstanceStore.Service
    yield* store.reload({ directory }).pipe(Effect.catch(() => Effect.void))
    yield* Config.Service.use((config) => config.invalidate())
  })
}

export function applyManifestToConfig(manifest: Manifest) {
  const patch: Partial<ConfigInfo> = {}
  if (manifest.persona_id) patch.default_agent = manifest.persona_id
  if (manifest.default_model) patch.model = manifest.default_model
  return patch
}

export function buildHubState(input: {
  directory: string
  manifest: Manifest
  registry: Registry
  agents: readonly { name: string; description?: string; mode?: string; prompt?: string; native?: boolean }[]
  skills: readonly { name: string; description?: string; location: string }[]
  mcps: readonly { name: string; status: string; type: string }[]
  sessions: readonly { id: string; title?: string; parentID?: string; time?: { updated?: number } }[]
}) {
  const groups = allGroups(input.registry).map((group) => ({
    ...group,
    enabled: (input.manifest.enabled_groups ?? ["default"]).includes(group.id),
  }))
  const effective = effectiveRefs(input.manifest, input.registry)
  const mcpRefs = refsByType(effective, "mcp")
  const mcpAllowAll = mcpRefs.length === 0
  const mcpEnabled = new Set(mcpRefs)
  return {
    directory: input.directory,
    manifest: input.manifest,
    groups,
    effective,
    personas: input.agents.map((agent) => ({
      id: agent.name,
      name: agent.name,
      description: agent.description,
      mode: agent.mode,
      active: input.manifest.persona_id === agent.name || (!input.manifest.persona_id && agent.name === "build"),
      custom: agent.native === false,
      enabled: effective.some((ref) => ref.type === "persona" && ref.ref === agent.name),
      locked: refLockedInBuiltinEnabled(input.manifest, input.registry, "persona", agent.name),
    })),
    skills: input.skills.map((skill) => ({
      id: skill.name,
      name: skill.name,
      description: skill.description,
      location: skill.location,
      enabled: effective.some((ref) => ref.type === "skill" && ref.ref === skill.name),
      locked: refLockedInBuiltinEnabled(input.manifest, input.registry, "skill", skill.name),
    })),
    mcps: input.mcps.map((mcp) => ({
      id: mcp.name,
      name: mcp.name,
      status: mcp.status,
      type: mcp.type,
      enabled: mcpAllowAll || mcpEnabled.has(mcp.name),
    })),
    threads: input.sessions.map((session) => ({
      id: session.id,
      title: session.title ?? session.id.slice(0, 8),
      parentID: session.parentID,
      updated: session.time?.updated,
      kind: session.parentID ? ("subagent" as const) : ("session" as const),
    })),
    mcpServe: {
      stdio: "agence mcp serve --directory <path>",
      global: "agence mcp serve --global",
      note: "Per-project MCP exposes hub state, persona, memory read/write, and proxied MCP tools. Global MCP lists all desktop projects.",
    },
  }
}

export function getHubState(directory: string) {
  return Effect.gen(function* () {
    const { ensureHubBundle } = yield* Effect.promise(() => import("./hub-bootstrap"))
    yield* ensureHubBundle(directory)
    const { registerProject } = yield* Effect.promise(() => import("./projects-index"))
    yield* registerProject(directory).pipe(Effect.catch(() => Effect.void))
    const manifest = yield* loadManifest(directory)
    const registry = yield* loadRegistry(directory)
    const agentSvc = yield* Agent.Service
    const skillSvc = yield* Skill.Service
    const configSvc = yield* Config.Service
    const mcpSvc = yield* MCP.Service
    const sessionSvc = yield* Session.Service
    const agents = yield* agentSvc.list()
    const skills = yield* skillSvc.all()
    const config = yield* configSvc.get()
    const mcpStatus = yield* mcpSvc.status()
    const sessions = yield* sessionSvc.list({ roots: true }).pipe(
      Effect.map((items) => items.filter((item) => !item.time?.archived)),
    )
    const mcps = Object.entries(config.mcp ?? {}).map(([name, entry]) => {
      const status = mcpStatus[name]
      return {
        name,
        status: status && typeof status === "object" && "status" in status ? String(status.status) : "unknown",
        type: typeof entry === "object" && entry && "type" in entry ? String(entry.type) : "unknown",
      }
    })
    const { syncFromManifest } = yield* Effect.promise(() => import("../session/goal"))
    const goalState = yield* syncFromManifest(directory, directory)
    return {
      ...buildHubState({
        directory,
        manifest,
        registry,
        agents,
        skills,
        mcps,
        sessions,
      }),
      goal: goalState
        ? { status: goalState.status, continuationCount: goalState.continuationCount ?? 0, budget: goalState.budget ?? 20 }
        : undefined,
    }
  })
}

export function updateManifest(directory: string, patch: Partial<Manifest>) {
  return Effect.gen(function* () {
    const current = yield* loadManifest(directory)
    const next = { ...current, ...patch }
    yield* saveManifest(directory, next)
    if (patch.goal !== undefined) {
      const { syncFromManifest } = yield* Effect.promise(() => import("../session/goal"))
      yield* syncFromManifest(directory, directory)
    }
    if (patch.persona_id !== undefined) yield* refreshProjectInstance(directory)
    return next
  })
}

export function updateRegistryGroups(directory: string, groups: readonly ResourceGroup[]) {
  return Effect.gen(function* () {
    const registry = yield* loadRegistry(directory)
    registry.groups = groups
      .filter((g) => !g.builtin)
      .map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        items: [...g.items],
      }))
    yield* saveRegistry(directory, registry)
    yield* refreshProjectInstance(directory)
    return registry
  })
}

export function toggleGroup(directory: string, groupID: string, enabled: boolean) {
  return Effect.gen(function* () {
    const manifest = yield* loadManifest(directory)
    const current = new Set(manifest.enabled_groups ?? ["default"])
    if (enabled) current.add(groupID)
    else current.delete(groupID)
    if (current.size === 0) current.add("default")
    const updatedManifest = { ...manifest, enabled_groups: [...current] }
    yield* saveManifest(directory, updatedManifest)
    yield* refreshProjectInstance(directory)
    return updatedManifest
  })
}

export function toggleResource(
  directory: string,
  input: { type: ResourceRef["type"]; ref: string; enabled: boolean },
  allMcpNames: readonly string[] = [],
) {
  return Effect.gen(function* () {
    const registry = yield* loadRegistry(directory)
    const manifest = yield* loadManifest(directory)

    if (input.type === "persona" && !input.enabled && manifest.persona_id === input.ref) {
      return yield* Effect.fail(
        new SkillInstallError({ message: "Choose another active persona before disabling this one." }),
      )
    }

    if (input.type === "mcp") {
      const effective = effectiveRefs(manifest, registry)
      const mcpRefs = refsByType(effective, "mcp")
      const allowAll = mcpRefs.length === 0

      if (input.enabled) {
        if (!allowAll) appendRefsToInstalledGroup(registry, [{ type: "mcp", ref: input.ref }])
      } else if (allowAll) {
        replaceInstalledRefsOfType(
          registry,
          "mcp",
          allMcpNames.filter((name) => name !== input.ref),
        )
      } else {
        removeRefFromInstalledGroup(registry, { type: "mcp", ref: input.ref })
      }
    } else if (input.enabled) {
      appendRefsToInstalledGroup(registry, [{ type: input.type, ref: input.ref }])
    } else {
      removeRefFromInstalledGroup(registry, { type: input.type, ref: input.ref })
    }

    yield* saveRegistry(directory, registry)

    const enabledGroups = new Set(manifest.enabled_groups ?? ["default"])
    if (input.enabled) enabledGroups.add(INSTALLED_GROUP_ID)
    const updatedManifest = { ...manifest, enabled_groups: [...enabledGroups] }
    yield* saveManifest(directory, updatedManifest)
    yield* refreshProjectInstance(directory)
    return updatedManifest
  })
}

export function installResource(directory: string, input: InstallInput) {
  return installFromGithub(directory, input).pipe(Effect.tap(() => refreshProjectInstance(directory)))
}

export function uploadResource(directory: string, input: { type: InstallInput["type"]; name: string; content: string }) {
  if (!SUPPORTED_UPLOAD_TYPES.has(input.type)) {
    return Effect.fail(
      new SkillInstallError({
        message: `${input.type} upload is not supported yet. Use persona, skill, mcp, or plugin.`,
      }),
    )
  }
  if (input.type === "persona") {
    return savePersona(directory, {
      name: input.name,
      prompt: input.content,
      activate: false,
    }).pipe(
      Effect.tap((saved) => wireInstalledRefs(directory, [{ type: "persona", ref: saved.id }])),
      Effect.tap(() => refreshProjectInstance(directory)),
    )
  }
  return Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    const slug = input.name.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase()
    const skillName =
      input.type === "skill" && typeof matter(input.content).data.name === "string"
        ? String(matter(input.content).data.name)
            .trim()
            .replace(/[^a-zA-Z0-9-_]+/g, "-")
            .toLowerCase()
        : slug
    const id = input.type === "skill" ? skillName : slug
    const root = path.join(directory, ".agence", "installs", id)
    const bundleRefs: ResourceRef[] = []

    if (input.type === "skill") {
      if (!matter(input.content).data.name) {
        return yield* Effect.fail(
          new SkillInstallError({
            message: "Skill upload requires YAML frontmatter with a name field.",
          }),
        )
      }
      yield* fs.writeWithDirs(path.join(root, "SKILL.md"), input.content)
      bundleRefs.push({ type: "skill", ref: id })
    }

    if (input.type === "mcp") {
      let parsed: { type?: string; command?: string; url?: string }
      try {
        parsed = JSON.parse(input.content) as { type?: string; command?: string; url?: string }
      } catch {
        return yield* Effect.fail(
          new SkillInstallError({ message: "MCP upload must be valid JSON with type and command or url." }),
        )
      }
      if (!parsed.type || (!parsed.command && !parsed.url)) {
        return yield* Effect.fail(
          new SkillInstallError({ message: "MCP JSON must include type and command or url." }),
        )
      }
      yield* fs.writeWithDirs(path.join(root, `${slug}.json`), JSON.stringify(parsed, null, 2))
      bundleRefs.push({ type: "mcp", ref: slug })
    }

    if (input.type === "plugin") {
      yield* fs.writeWithDirs(path.join(root, `${slug}.md`), input.content)
    }

    const registry = yield* loadRegistry(directory)
    const list =
      input.type === "skill"
        ? (registry.skills ?? (registry.skills = []))
        : input.type === "mcp"
          ? (registry.mcps ?? (registry.mcps = []))
          : (registry.plugins ?? (registry.plugins = []))
    const entry = {
      id: input.type === "mcp" ? slug : id,
      name: input.name,
      enabled: true,
      source: "upload" as const,
      path: root,
    }
    const index = list.findIndex((item) => item.id === entry.id)
    if (index >= 0) list[index] = { ...list[index], ...entry }
    else list.push(entry)
    yield* saveRegistry(directory, registry)
    yield* wireInstalledRefs(directory, bundleRefs)
    yield* refreshProjectInstance(directory)
    return entry
  })
}

export { savePersona, loadPersonaContent, personaFilePath }

export * as ProjectHub from "./hub"
