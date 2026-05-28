import { Context, Effect, Layer } from "effect"

import { InstanceState } from "@/effect/instance-state"
import path from "path"
import fs from "fs/promises"

import PROMPT_ANTHROPIC from "./prompt/anthropic.txt"
import PROMPT_DEFAULT from "./prompt/default.txt"
import PROMPT_BEAST from "./prompt/beast.txt"
import PROMPT_GEMINI from "./prompt/gemini.txt"
import PROMPT_GPT from "./prompt/gpt.txt"
import PROMPT_KIMI from "./prompt/kimi.txt"

import PROMPT_CODEX from "./prompt/codex.txt"
import PROMPT_TRINITY from "./prompt/trinity.txt"
import type { Provider } from "@/provider/provider"
import type { Agent } from "@/agent/agent"
import { Permission } from "@/permission"
import { Skill } from "@/skill"
import { recallMemoriesForContext } from "@/learning/memory-intelligence"

const PROMPTS = {
  anthropic: PROMPT_ANTHROPIC,
  default: PROMPT_DEFAULT,
  beast: PROMPT_BEAST,
  gemini: PROMPT_GEMINI,
  gpt: PROMPT_GPT,
  kimi: PROMPT_KIMI,
  codex: PROMPT_CODEX,
  trinity: PROMPT_TRINITY,
}

function loadWikiContext(directory: string) {
  return Effect.gen(function* () {
    const indexPath = path.join(directory, ".agence", "knowledge", "wiki", "index.md")
    const content = yield* Effect.tryPromise(() => fs.readFile(indexPath, "utf-8")).pipe(
      Effect.catch(() => Effect.succeed("")),
    )
    if (!content.trim()) return

    const lines = content.split("\n").filter((l) => l.trim()).slice(0, 40)
    return [
      `<knowledge_base>`,
      `You have a project knowledge base at .agence/knowledge/wiki/. Use kb_search to look up any topic.`,
      `Current wiki index:`,
      ...lines.map((l) => `  ${l}`),
      `</knowledge_base>`,
    ].join("\n")
  })
}

function loadLearningsContext(projectId: string, directory: string) {
  return recallMemoriesForContext({
    projectId,
    query: `project ${directory} coding preferences errors workflows`,
    limit: 8,
  }).pipe(Effect.catch(() => Effect.succeed(undefined)))
}

function loadHeartbeatContext(directory: string) {
  return Effect.gen(function* () {
    const heartbeatPath = path.join(directory, "HEARTBEAT.md")
    const content = yield* Effect.tryPromise(() => fs.readFile(heartbeatPath, "utf-8")).pipe(
      Effect.catch(() => Effect.succeed("")),
    )
    if (!content.trim()) return undefined

    return [
      `<heartbeat_tasks>`,
      `You have background heartbeat task checklist in HEARTBEAT.md:`,
      content.trim().split("\n").slice(0, 50).join("\n"),
      `</heartbeat_tasks>`,
    ].join("\n")
  })
}

export function provider(model: Provider.Model) {
  if (model.api.id.includes("gpt-4") || model.api.id.includes("o1") || model.api.id.includes("o3"))
    return [PROMPT_BEAST]
  if (model.api.id.includes("gpt")) {
    if (model.api.id.includes("codex")) return [PROMPT_CODEX]
    return [PROMPT_GPT]
  }
  if (model.api.id.includes("gemini-")) return [PROMPT_GEMINI]
  if (model.api.id.includes("claude")) return [PROMPT_ANTHROPIC]
  if (model.api.id.toLowerCase().includes("trinity")) return [PROMPT_TRINITY]
  if (model.api.id.toLowerCase().includes("kimi")) return [PROMPT_KIMI]
  return [PROMPT_DEFAULT]
}

export interface Interface {
  readonly environment: (model: Provider.Model) => Effect.Effect<string[]>
  readonly skills: (agent: Agent.Info) => Effect.Effect<string | undefined>
}

export class Service extends Context.Service<Service, Interface>()("@agence/SystemPrompt") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const skill = yield* Skill.Service

    const environment = (model: Provider.Model) =>
      Effect.gen(function* () {
        const ctx = yield* InstanceState.context
        const envBlock = [
          `You are powered by the model named ${model.api.id}. The exact model ID is ${model.providerID}/${model.api.id}`,
          `Here is some useful information about the environment you are running in:`,
          `<env>`,
          `  Working directory: ${ctx.directory}`,
          `  Workspace root folder: ${ctx.worktree}`,
          `  Is directory a git repo: ${ctx.project.vcs === "git" ? "yes" : "no"}`,
          `  Platform: ${process.platform}`,
          `  Today's date: ${new Date().toDateString()}`,
          `</env>`,
        ].join("\n")

        const wikiContext = yield* loadWikiContext(ctx.directory).pipe(Effect.catch(() => Effect.succeed(undefined)))
        const learningContext = yield* loadLearningsContext(ctx.project.id, ctx.directory).pipe(
          Effect.catch(() => Effect.succeed(undefined)),
        )
        const heartbeatContext = yield* loadHeartbeatContext(ctx.directory).pipe(Effect.catch(() => Effect.succeed(undefined)))

        const blocks = [envBlock]
        if (wikiContext) blocks.push(wikiContext)
        if (learningContext) blocks.push(learningContext)
        if (heartbeatContext) blocks.push(heartbeatContext)

        return blocks
      })

    const skills = (agent: Agent.Info) =>
      Effect.gen(function* () {
        const list = yield* skill.available(agent)
        if (list.length === 0) return undefined

        return [
          `You have the following procedural skills loaded from the project directory. Use the "skill" tool to execute them:`,
          ...list.map((s) => `  - ${s.name}: ${s.description ?? ""}`),
        ].join("\n")
      })

    return Service.of({
      environment,
      skills,
    })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Skill.defaultLayer))

export * as SystemPrompt from "./system"
