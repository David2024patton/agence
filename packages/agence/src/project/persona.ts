import path from "path"
import matter from "gray-matter"
import { Effect } from "effect"
import { AppFileSystem } from "@agence-ai/core/filesystem"
import { Config } from "@/config/config"
import { loadRegistry, saveRegistry } from "./registry"

export function personaAgentsDir(directory: string) {
  return path.join(directory, ".agence", "agents")
}

export function personaSlug(name: string) {
  const slug = name
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .toLowerCase()
    .replace(/^-+|-+$/g, "")
  return slug.length > 0 ? slug : "persona"
}

export function personaFilePath(directory: string, id: string) {
  return path.join(personaAgentsDir(directory), `${id}.md`)
}

export function formatPersonaMarkdown(input: {
  description?: string
  mode?: string
  prompt: string
}) {
  const frontmatter: string[] = ["---"]
  if (input.description?.trim()) {
    frontmatter.push(`description: ${JSON.stringify(input.description.trim())}`)
  }
  frontmatter.push(`mode: ${input.mode ?? "primary"}`)
  frontmatter.push("---", "", input.prompt.trim(), "")
  return frontmatter.join("\n")
}

export function parsePersonaMarkdown(content: string) {
  const parsed = matter(content)
  const mode = typeof parsed.data.mode === "string" ? parsed.data.mode : "primary"
  const description = typeof parsed.data.description === "string" ? parsed.data.description : undefined
  return {
    description,
    mode,
    prompt: parsed.content.trim(),
  }
}

export function savePersona(
  directory: string,
  input: {
    id?: string
    name: string
    description?: string
    mode?: "primary" | "subagent" | "all"
    prompt: string
    activate?: boolean
  },
) {
  return Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    const config = yield* Config.Service
    const id = input.id ?? personaSlug(input.name)
    const filePath = personaFilePath(directory, id)
    yield* fs.writeWithDirs(
      filePath,
      formatPersonaMarkdown({
        description: input.description,
        mode: input.mode,
        prompt: input.prompt,
      }),
    )

    const registry = yield* loadRegistry(directory)
    const list = registry.personas ?? (registry.personas = [])
    const entry = {
      id,
      name: input.name.trim(),
      enabled: true,
      source: "upload" as const,
      path: personaAgentsDir(directory),
    }
    const index = list.findIndex((item) => item.id === id)
    if (index >= 0) list[index] = { ...list[index], ...entry }
    else list.push(entry)
    yield* saveRegistry(directory, registry)
    yield* config.invalidate()

    if (input.activate) {
      const manifestModule = yield* Effect.promise(() => import("./manifest"))
      const hubModule = yield* Effect.promise(() => import("./hub"))
      yield* hubModule.updateManifest(directory, { persona_id: id })
    }

    return { id, name: input.name.trim(), path: filePath }
  })
}

export function loadPersonaContent(directory: string, id: string) {
  return Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    const filePath = personaFilePath(directory, id)
    if (!(yield* fs.existsSafe(filePath))) return yield* Effect.die(new Error(`Persona not found: ${id}`))
    const content = yield* fs.readFileStringSafe(filePath)
    if (!content) return yield* Effect.die(new Error(`Persona not found: ${id}`))
    const parsed = parsePersonaMarkdown(content)
    const registry = yield* loadRegistry(directory)
    const entry = registry.personas?.find((item) => item.id === id)
    return {
      id,
      name: entry?.name ?? id,
      description: parsed.description,
      mode: parsed.mode,
      prompt: parsed.prompt,
    }
  })
}

export * as ProjectPersona from "./persona"
