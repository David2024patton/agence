import path from "path"

import { cp, mkdir, readFile } from "fs/promises"

import matter from "gray-matter"

import { AppFileSystem } from "@agence-ai/core/filesystem"

import { Glob } from "@agence-ai/core/util/glob"

import { Effect, Schema, Types } from "effect"

import { personaAgentsDir, personaSlug, parsePersonaMarkdown } from "./persona"

import {
  installsRoot,
  loadRegistry,
  ResourceType,
  saveRegistry,
  wireInstalledRefs,
  type Registry,
  type ResourceEntry,
  type ResourceRef,
} from "./registry"

export class SkillInstallError extends Schema.TaggedErrorClass<SkillInstallError>()(
  "SkillInstallError",

  {
    message: Schema.String,
  },

  { httpApiStatus: 400 },
) {}

const SUPPORTED_INSTALL_TYPES = new Set<ResourceType>(["persona", "skill", "mcp", "plugin"])

export const InstallInput = Schema.Struct({
  type: ResourceType,

  github: Schema.String,

  subpath: Schema.optional(Schema.String),

  id: Schema.optional(Schema.String),

  name: Schema.optional(Schema.String),
})

export type InstallInput = Schema.Schema.Type<typeof InstallInput>

export function parseGithub(input: string) {
  const trimmed = input

    .trim()

    .replace(/^git@github\.com:/, "")

    .replace(/^https?:\/\/github\.com\//, "")

    .replace(/\.git$/, "")

    .replace(/\/$/, "")

  const parts = trimmed.split("/").filter(Boolean)

  if (parts.length < 2) return

  const owner = parts[0]

  const repo = parts[1]

  if (parts[2] === "tree" || parts[2] === "blob") {
    const branch = parts[3]

    let subpath = parts.slice(4).join("/") || undefined

    if (parts[2] === "blob" && subpath) subpath = path.posix.dirname(subpath)

    if (subpath === ".") subpath = undefined

    return { owner, repo, branch, subpath }
  }

  if (parts.length > 2) return { owner, repo, branch: undefined, subpath: parts.slice(2).join("/") }

  return { owner, repo, branch: undefined, subpath: undefined }
}

function installError(message: string) {
  return Effect.fail(new SkillInstallError({ message }))
}

function assertSupportedType(type: ResourceType) {
  if (!SUPPORTED_INSTALL_TYPES.has(type)) {
    return installError(`${type} install is not supported yet. Use persona, skill, mcp, or plugin.`)
  }

  return Effect.void
}

function entryList(registry: Types.DeepMutable<Registry>, type: ResourceType) {
  if (type === "persona") return registry.personas ?? (registry.personas = [])

  if (type === "skill") return registry.skills ?? (registry.skills = [])

  if (type === "mcp") return registry.mcps ?? (registry.mcps = [])

  return registry.plugins ?? (registry.plugins = [])
}

function resolveInstallRoot(dest: string, subpath: string) {
  return Effect.gen(function* () {
    const base = path.resolve(dest)
    const root = path.resolve(dest, subpath || ".")
    if (root !== base && !root.startsWith(`${base}${path.sep}`)) {
      return yield* installError("Install subpath escapes the clone directory.")
    }
    return root
  })
}

function gitMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message.trim()

  return "Git command failed. Check the repo URL, branch, network, and that git is installed."
}

function gitClone(url: string, dest: string, branch?: string) {
  return Effect.tryPromise(async () => {
    const args = ["clone", "--depth", "1"]

    if (branch) args.push("--branch", branch)

    args.push(url, dest)

    if (typeof Bun !== "undefined") {
      const proc = Bun.spawn(["git", ...args], { stdout: "pipe", stderr: "pipe" })
      const exit = await proc.exited

      if (exit !== 0) {
        const stderr = await new Response(proc.stderr).text()

        throw new Error(stderr.trim() || `git clone exited with ${exit}`)
      }

      return
    }

    await new Promise<void>((resolve, reject) => {
      import("child_process").then(({ execFile }) => {
        execFile("git", args, (err, _stdout, stderr) => {
          if (err) reject(new Error(String(stderr || err.message)))
          else resolve()
        })
      })
    })
  }).pipe(Effect.mapError((error) => new SkillInstallError({ message: gitMessage(error) })))
}

function gitPull(dest: string) {
  return Effect.tryPromise(async () => {
    if (typeof Bun !== "undefined") {
      const proc = Bun.spawn(["git", "-C", dest, "pull"], { stdout: "pipe", stderr: "pipe" })

      const exit = await proc.exited

      if (exit !== 0) {
        const stderr = await new Response(proc.stderr).text()

        throw new Error(stderr.trim() || `git pull exited with ${exit}`)
      }

      return
    }

    await new Promise<void>((resolve, reject) => {
      import("child_process").then(({ execFile }) => {
        execFile("git", ["-C", dest, "pull"], (err, _stdout, stderr) => {
          if (err) reject(new Error(String(stderr || err.message)))
          else resolve()
        })
      })
    })
  }).pipe(Effect.mapError((error) => new SkillInstallError({ message: gitMessage(error) })))
}

function skillFrontmatter(data: unknown) {
  if (!data || typeof data !== "object") return

  const record = data as Record<string, unknown>

  if (typeof record.name !== "string" || !record.name.trim()) return

  if (record.description !== undefined && typeof record.description !== "string") return

  return { name: record.name.trim(), description: record.description?.trim() }
}

function copySkillDir(src: string, dest: string) {
  return Effect.tryPromise(async () => {
    await mkdir(dest, { recursive: true })

    await cp(src, dest, { recursive: true, force: true })
  })
}

export function normalizeInstalledSkills(directory: string, installRoot: string) {
  return Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service

    const installs = installsRoot(directory)

    const files = yield* Effect.promise(() =>
      Glob.scan("**/SKILL.md", { cwd: installRoot, absolute: true, dot: true, symlink: false }),
    )

    const names = new Set<string>()

    for (const file of files) {
      const content = yield* fs.readFileString(file).pipe(Effect.catch(() => Effect.succeed("")))

      if (!content.trim()) continue

      const frontmatter = skillFrontmatter(matter(content).data)

      if (!frontmatter) continue

      const skillDir = path.dirname(file)

      const dest = path.join(installs, frontmatter.name)

      if (names.has(frontmatter.name)) {
        return yield* installError(`Duplicate skill name in repo: ${frontmatter.name}`)
      }

      if (path.resolve(skillDir) !== path.resolve(dest)) yield* copySkillDir(skillDir, dest)

      names.add(frontmatter.name)
    }

    return [...names]
  })
}

function discoverMcpNames(installRoot: string) {
  return Effect.promise(async () => {
    const files = await Glob.scan("**/*.{json,jsonc}", {
      cwd: installRoot,

      absolute: true,

      dot: true,

      symlink: false,
    })

    const names: string[] = []

    for (const source of files) {
      const base = path.basename(source).replace(/\.jsonc?$/, "")

      const prefix = path

        .relative(installRoot, path.dirname(source))

        .split(path.sep)

        .filter(Boolean)

        .join("-")

      const name = prefix ? `${prefix}-${base}` : base

      try {
        const content = await readFile(source, "utf-8")

        const parsed = JSON.parse(content) as { type?: string; command?: string; url?: string }

        if (parsed.type && (parsed.command || parsed.url)) names.push(name)
      } catch {
        // skip malformed configs
      }
    }

    return names
  })
}

function importPersonasFromInstall(directory: string, installRoot: string) {
  return Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service

    const patterns = ["agents/**/*.md", "agent/**/*.md", ".opencode/agents/**/*.md", ".opencode/agent/**/*.md"]

    const agentsDir = personaAgentsDir(directory)

    const imported: Array<{ id: string; name: string }> = []

    const seen = new Set<string>()

    for (const pattern of patterns) {
      const files = yield* Effect.promise(() =>
        Glob.scan(pattern, { cwd: installRoot, absolute: true, dot: true, symlink: false }),
      )

      for (const file of files) {
        const base = path.basename(file, ".md")

        const id = personaSlug(base)

        if (seen.has(id)) continue

        seen.add(id)

        const content = yield* fs.readFileString(file).pipe(Effect.catch(() => Effect.succeed("")))

        if (!content.trim()) continue

        const parsed = parsePersonaMarkdown(content)

        yield* fs.writeWithDirs(path.join(agentsDir, `${id}.md`), content)

        imported.push({ id, name: parsed.description?.trim() || base })
      }
    }

    return imported
  })
}

export function installFromGithub(directory: string, input: InstallInput) {
  return Effect.gen(function* () {
    yield* assertSupportedType(input.type)

    const parsed = parseGithub(input.github)

    if (!parsed) {
      return yield* installError(
        `Invalid GitHub ref: ${input.github}. Use owner/repo or a full https://github.com/owner/repo URL.`,
      )
    }

    const fs = yield* AppFileSystem.Service

    const subpath = input.subpath?.trim() || parsed.subpath || ""

    const id = input.id ?? `${parsed.owner}-${parsed.repo}`

    const dest = path.join(installsRoot(directory), id)

    const url = `https://github.com/${parsed.owner}/${parsed.repo}.git`

    if (yield* fs.existsSafe(path.join(dest, ".git"))) {
      yield* gitPull(dest)
    } else if (!(yield* fs.existsSafe(dest))) {
      yield* Effect.tryPromise(() => mkdir(path.dirname(dest), { recursive: true }))
      yield* gitClone(url, dest, parsed.branch)
    }

    const root = yield* resolveInstallRoot(dest, subpath)

    if (!(yield* fs.existsSafe(root))) {
      return yield* installError(`Install path not found after clone: ${subpath || "(repo root)"}`)
    }

    const bundleRefs: ResourceRef[] = []

    let personaImports: Array<{ id: string; name: string }> = []

    if (input.type === "persona") {
      personaImports = yield* importPersonasFromInstall(directory, root)

      if (personaImports.length === 0) {
        return yield* installError(
          "No persona markdown found. Use agents/*.md or .opencode/agents/*.md in the repo or subpath.",
        )
      }

      for (const persona of personaImports) bundleRefs.push({ type: "persona", ref: persona.id })
    }

    const installedSkills = input.type === "skill" ? yield* normalizeInstalledSkills(directory, root) : ([] as string[])

    if (input.type === "skill" && installedSkills.length === 0) {
      return yield* installError(
        "No valid SKILL.md found. Use a repo with skills/my-skill/SKILL.md (or .opencode/skills/...) and YAML frontmatter: name + description.",
      )
    }

    for (const name of installedSkills) bundleRefs.push({ type: "skill", ref: name })

    const installedMcps = input.type === "mcp" ? yield* discoverMcpNames(root) : ([] as string[])

    if (input.type === "mcp" && installedMcps.length === 0) {
      return yield* installError(
        "No MCP config found. Add a .json file with type and command or url under the repo or subpath.",
      )
    }

    for (const name of installedMcps) bundleRefs.push({ type: "mcp", ref: name })

    const registry = yield* loadRegistry(directory)

    const list = entryList(registry, input.type)

    if (input.type === "skill") {
      for (const name of installedSkills) {
        const entry: ResourceEntry = {
          id: name,

          name,

          enabled: true,

          source: "github",

          path: path.join(installsRoot(directory), name),

          github: input.github,
        }

        const index = list.findIndex((item) => item.id === name)

        if (index >= 0) list[index] = { ...list[index], ...entry }
        else list.push(entry)
      }
    } else if (input.type === "persona") {
      const personaList = registry.personas ?? (registry.personas = [])

      for (const persona of personaImports) {
        const entry: ResourceEntry = {
          id: persona.id,

          name: persona.name,

          enabled: true,

          source: "github",

          path: personaAgentsDir(directory),

          github: input.github,
        }

        const index = personaList.findIndex((item) => item.id === persona.id)

        if (index >= 0) personaList[index] = { ...personaList[index], ...entry }
        else personaList.push(entry)
      }
    } else if (input.type === "mcp") {
      for (const name of installedMcps) {
        const entry: ResourceEntry = {
          id: name,

          name,

          enabled: true,

          source: "github",

          path: root,

          github: input.github,
        }

        const index = list.findIndex((item) => item.id === name)

        if (index >= 0) list[index] = { ...list[index], ...entry }
        else list.push(entry)
      }
    } else {
      const entry: ResourceEntry = {
        id,

        name: input.name ?? id,

        enabled: true,

        source: "github",

        path: root,

        github: input.github,
      }

      const index = list.findIndex((item) => item.id === id)

      if (index >= 0) list[index] = { ...list[index], ...entry }
      else list.push(entry)
    }

    yield* saveRegistry(directory, registry)

    yield* wireInstalledRefs(directory, bundleRefs)

    if (input.type === "skill") {
      return {
        id,

        name: input.name ?? id,

        skills: installedSkills,

        path: root,

        github: input.github,

        source: "github" as const,
      }
    }

    if (input.type === "persona") {
      return {
        id,

        name: input.name ?? id,

        personas: personaImports.map((item) => item.id),

        path: root,

        github: input.github,

        source: "github" as const,
      }
    }

    if (input.type === "mcp") {
      return {
        id,

        name: input.name ?? id,

        mcps: installedMcps,

        path: root,

        github: input.github,

        source: "github" as const,
      }
    }

    const entry = list.find((item) => item.id === id)

    return entry ?? { id, name: input.name ?? id, path: root, github: input.github, source: "github" as const }
  })
}

export * as ProjectInstaller from "./installer"
