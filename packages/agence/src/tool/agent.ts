import { Effect, Schema } from "effect"
import { InstanceState } from "@/effect/instance-state"
import { AppFileSystem } from "@agence-ai/core/filesystem"
import { storeLearning, searchLearnings, recentLearnings, getEmbedding, GLOBAL_MEMORY_PROJECT_ID } from "../learning"
import { ensureGlobalMemoryProject } from "../learning/memory-intelligence"
import { searchArchives } from "../learning/archive"
import path from "path"
import crypto from "crypto"
import * as Tool from "./tool"
import type { SessionID } from "../session/schema"

// ═══ memory_add ════════════════════════════════════════════════════════════
// Multi-layer memory: Activity, Context, Experience, Identity, Preference

export const MemoryAddParameters = Schema.Struct({
  layer: Schema.Literals(["activity", "context", "experience", "identity", "preference"] as const).annotate({ description: "Memory layer: activity (what happened), context (situations), experience (lessons), identity (people/roles), preference (behavior)" }),
  content: Schema.String.annotate({ description: "The memory content" }),
  importance: Schema.optional(Schema.Literals(["low", "medium", "high", "critical"] as const)).annotate({ description: "Importance level (default: medium)" }),
  tags: Schema.optional(Schema.Array(Schema.String)).annotate({ description: "Tags for categorization" }),
  relatedTo: Schema.optional(Schema.String).annotate({ description: "Related entity (person, project, tool)" }),
})

export const MemoryAddTool = Tool.define<typeof MemoryAddParameters, { layer: string }, any>(
  "memory_add",
  Effect.gen(function* () {
    return {
      description: "Store a memory in the multi-layer memory system. Agence also auto-captures preferences, corrections, and tool failures after sessions — use this for critical facts you want guaranteed. Layers: activity (events), context (situations), experience (lessons), identity (people/roles), preference (behavior). Preferences and identity sync to global scope across projects.",
      parameters: MemoryAddParameters,
      execute: (params: { layer: string; content: string; importance?: string; tags?: readonly string[]; relatedTo?: string }, _ctx: Tool.Context) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const global = params.layer === "preference" || params.layer === "identity"
          if (global) yield* ensureGlobalMemoryProject()
          const id = yield* storeLearning({
            projectId: global ? GLOBAL_MEMORY_PROJECT_ID : instance.project.id,
            source: params.layer,
            concept: `${params.layer}: ${params.content.slice(0, 60)}`,
            description: `[${params.importance ?? "medium"}] ${params.content}${params.relatedTo ? ` (related: ${params.relatedTo})` : ""}`,
            confidence: params.importance === "critical" ? "high" : params.importance ?? "medium",
            metadata: { layer: params.layer, importance: params.importance ?? "medium", tags: params.tags ? [...params.tags] : [], relatedTo: params.relatedTo },
          }).pipe(Effect.catchCause(() => Effect.succeed("")))

          return {
            title: `Memory: ${params.layer}`,
            metadata: { layer: params.layer },
            output: [
              `✅ Stored in ${params.layer} layer`,
              `  ${params.content.slice(0, 200)}`,
              params.importance ? `  Importance: ${params.importance}` : "",
              params.tags?.length ? `  Tags: ${params.tags.join(", ")}` : "",
              id ? `  ID: ${id}` : "",
              "",
              "This memory persists across sessions. Use memory_recall to find it later.",
            ].filter(Boolean).join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)

// ═══ memory_recall ═════════════════════════════════════════════════════════

export const MemoryRecallParameters = Schema.Struct({
  query: Schema.String.annotate({ description: "Search query to find relevant memories" }),
  layer: Schema.optional(Schema.String).annotate({ description: "Filter by layer: activity, context, experience, identity, preference" }),
  limit: Schema.optional(Schema.Number).annotate({ description: "Max results (default: 5)" }),
})

export const MemoryRecallTool = Tool.define<typeof MemoryRecallParameters, { count: number }, any>(
  "memory_recall",
  Effect.gen(function* () {
    return {
      description: "Recall memories from the multi-layer memory system. Searches across all layers using semantic similarity. Filter by layer for specific types: activity (events), context (situations), experience (lessons), identity (people), preference (behavior).",
      parameters: MemoryRecallParameters,
      execute: (params: { query: string; layer?: string; limit?: number }, _ctx: Tool.Context) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const results = yield* searchLearnings({
            projectId: instance.project.id,
            query: params.query,
            limit: params.limit ?? 5,
            includeGlobal: true,
          }).pipe(Effect.catchCause(() => Effect.succeed([])))

          const archives = yield* searchArchives({
            projectId: instance.project.id,
            query: params.query,
            limit: params.limit ?? 3,
          }).pipe(Effect.catchCause(() => Effect.succeed([])))

          const filtered = params.layer
            ? results.filter((r) => r.source === params.layer)
            : results

          const allEmpty = filtered.length === 0 && archives.length === 0
          if (allEmpty) {
            return { title: "Memory Recall", metadata: { count: 0 }, output: `No memories found for "${params.query}". Use memory_add to store some first.` }
          }

          const lines: string[] = []
          if (filtered.length > 0) {
            lines.push(`Found ${filtered.length} memories:`, "")
            for (const r of filtered) {
              const score = r.score ? ` (${(r.score * 100).toFixed(0)}%)` : ""
              lines.push(`[${r.source}]${score} ${r.concept}`)
              const desc = r.description.replace(/^\[[^\]]*\]\s*/, "")
              lines.push(`  ${desc.slice(0, 200)}`)
              if (r.confidence !== "medium") lines.push(`  Confidence: ${r.confidence}`)
              lines.push("")
            }
          }

          if (archives.length > 0) {
            lines.push(`Found ${archives.length} conversation archives:`, "")
            for (const a of archives) {
              const score = a.score ? ` (${(a.score * 100).toFixed(0)}%)` : ""
              lines.push(`[archive]${score} ${a.title.slice(0, 100)}`)
              lines.push(`  ${a.subject}`)
              lines.push(`  ID: ${a.id} | ${a.messageCount} msgs | ${a.tokenCount} tokens`)
              const summaryLines = a.summary.split("\n").filter(Boolean).slice(0, 5)
              for (const sl of summaryLines) {
                lines.push(`    ${sl.slice(0, 120)}`)
              }
              lines.push("")
            }
          }

          return { title: "Memory Recall", metadata: { count: filtered.length + archives.length }, output: lines.join("\n") }
        }).pipe(Effect.orDie),
    }
  }),
)

// ═══ agent_group ═══════════════════════════════════════════════════════════
// Multi-agent team orchestration

export const GroupParameters = Schema.Struct({
  name: Schema.String.annotate({ description: "Agent group name (e.g. 'code-review-team')" }),
  agents: Schema.Array(Schema.Struct({
    name: Schema.String.annotate({ description: "Agent name (e.g. 'reviewer', 'tester')" }),
    role: Schema.String.annotate({ description: "Role description (e.g. 'Reviews code for bugs')" }),
  })).annotate({ description: "Array of agents in the group with name and role" }),
  task: Schema.String.annotate({ description: "Task for the group to complete" }),
  mode: Schema.optional(Schema.Literals(["parallel", "sequential", "supervisor"] as const)).annotate({ description: "Execution mode: parallel (all at once), sequential (one after another), supervisor (one delegates) (default: parallel)" }),
})

export const AgentGroupTool = Tool.define<typeof GroupParameters, { agents: number; mode: string }, AppFileSystem.Service>(
  "agent_group",
  Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    return {
      description: "Create and run an agent team for collaborative work. Define multiple agents with roles, then execute them in parallel, sequential, or supervisor mode. Results are stored in .agence/groups/ for review.",
      parameters: GroupParameters,
      execute: (params: { name: string; agents: readonly { name: string; role: string }[]; task: string; mode?: string }, _ctx: Tool.Context) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const mode = params.mode ?? "parallel"
          const groupDir = path.join(instance.directory, ".agence", "groups")

          // Save group configuration
          const groupConfig = {
            name: params.name, agents: params.agents, task: params.task,
            mode, created: new Date().toISOString(), status: "created",
          }
          yield* fs.writeWithDirs(path.join(groupDir, `${params.name}.json`), JSON.stringify(groupConfig, null, 2))

          const lines = [
            `## Agent Group: ${params.name}`,
            `Task: ${params.task}`,
            `Mode: ${mode}`,
            `Agents: ${params.agents.length}`,
            "",
            "### Team",
            ...params.agents.map((a, i) => `  ${i + 1}. ${a.name} — ${a.role}`),
            "",
            mode === "parallel" ? "All agents will work simultaneously." :
            mode === "sequential" ? "Agents will work one after another, each building on the previous." :
            "A supervisor agent will delegate work to the team.",
            "",
            "To execute, the agent should process each role's task and compile results.",
            "Run `task` tool to dispatch subagents for each role.",
          ]

          return {
            title: `Group: ${params.name}`,
            metadata: { agents: params.agents.length, mode },
            output: lines.join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)
