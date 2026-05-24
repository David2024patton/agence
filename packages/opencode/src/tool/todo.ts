import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import DESCRIPTION_WRITE from "./todowrite.txt"
import DESCRIPTION_READ from "./todoread.txt"
import DESCRIPTION_REFLECT from "./reflect.txt"
import DESCRIPTION_SEARCH from "./task_search.txt"
import DESCRIPTION_CARRY from "./todo_carry.txt"
import DESCRIPTION_MODEL from "./model_learn.txt"
import QGATE_DESC from "./quality_gate.txt"
import { Todo } from "../session/todo"
import type { SessionID } from "../session/schema"
import { storeLearning, searchLearnings } from "../learning"
import { AppFileSystem } from "@opencode-ai/core/filesystem"
import { InstanceState } from "@/effect/instance-state"
import path from "path"

const TodoItem = Schema.Struct({
  id: Schema.optional(Schema.String).annotate({ description: "Auto-generated unique ID for this task." }),
  content: Schema.String.annotate({ description: "Brief description of the task" }),
  description: Schema.optional(Schema.String).annotate({ description: "Optional detailed description or notes" }),
  status: Schema.String.annotate({ description: "Current status: pending, in_progress, completed, cancelled" }),
  priority: Schema.String.annotate({ description: "Priority: high, medium, low" }),
  parentId: Schema.optional(Schema.String).annotate({ description: "Parent task ID for subtasks" }),
  dependsOn: Schema.optional(Schema.Array(Schema.String)).annotate({ description: "Task IDs that must be completed before this one" }),
  tags: Schema.optional(Schema.Array(Schema.String)).annotate({ description: "Labels: bug, feature, refactor, docs, test, etc." }),
})

type WriteMetadata = { todos: Todo.Info[]; summary: string }

export const WriteParameters = Schema.Struct({
  todos: Schema.mutable(Schema.Array(TodoItem)).annotate({ description: "The updated todo list" }),
})

export const TodoWriteTool = Tool.define<typeof WriteParameters, WriteMetadata, Todo.Service>(
  "todowrite",
  Effect.gen(function* () {
    const todo = yield* Todo.Service
    return {
      description: DESCRIPTION_WRITE,
      parameters: WriteParameters,
      execute: (params: Schema.Schema.Type<typeof WriteParameters>, ctx: Tool.Context<WriteMetadata>) =>
        Effect.gen(function* () {
          yield* ctx.ask({ permission: "todowrite", patterns: ["*"], always: ["*"], metadata: {} })
          yield* todo.update({ sessionID: ctx.sessionID, todos: params.todos })
          const active = params.todos.filter((x) => x.status !== "completed" && x.status !== "cancelled").length
          const subs = params.todos.filter((x) => x.parentId).length
          const deps = params.todos.filter((x) => x.dependsOn?.length).length
          const parts = [`${active} active`]
          if (subs > 0) parts.push(`${subs} subtasks`)
          if (deps > 0) parts.push(`${deps} with dependencies`)
          parts.push(`${params.todos.length} total`)
          return {
            title: parts.join(", "),
            output: JSON.stringify(params.todos, null, 2),
            metadata: { todos: params.todos, summary: parts.join(", ") },
          }
        }),
    } satisfies Tool.DefWithoutID<typeof WriteParameters, WriteMetadata>
  }),
)

export const ReadParameters = Schema.Struct({
  sessionId: Schema.optional(Schema.String).annotate({ description: "Session ID. Omit for all sessions." }),
})

export const TodoReadTool = Tool.define<typeof ReadParameters, { count: number }, Todo.Service>(
  "todoread",
  Effect.gen(function* () {
    const todo = yield* Todo.Service
    return {
      description: DESCRIPTION_READ,
      parameters: ReadParameters,
      execute: (params: { sessionId?: string }, _ctx: Tool.Context) =>
        Effect.gen(function* () {
          const todos = params.sessionId ? yield* todo.get(params.sessionId as SessionID) : yield* todo.getAll()
          if (todos.length === 0) return { title: "Todos", metadata: { count: 0 }, output: "No todos found." }
          return { title: "Todos", metadata: { count: todos.length }, output: formatTodos(todos).join("\n") }
        }).pipe(Effect.orDie),
    }
  }),
)

export const SearchParameters = Schema.Struct({
  query: Schema.String.annotate({ description: "Search term to find in task content and descriptions" }),
})

export const TaskSearchTool = Tool.define<typeof SearchParameters, { count: number }, Todo.Service>(
  "task_search",
  Effect.gen(function* () {
    const todo = yield* Todo.Service
    return {
      description: DESCRIPTION_SEARCH,
      parameters: SearchParameters,
      execute: (params: { query: string }, _ctx: Tool.Context) =>
        Effect.gen(function* () {
          const todos = yield* todo.search(params.query)
          if (todos.length === 0) return { title: "Search", metadata: { count: 0 }, output: `No tasks found matching "${params.query}".` }
          return { title: `Search: ${params.query}`, metadata: { count: todos.length }, output: [`Found ${todos.length} tasks:`, "", ...formatTodos(todos)].join("\n") }
        }).pipe(Effect.orDie),
    }
  }),
)

export const CarryParameters = Schema.Struct({
  fromSessionId: Schema.String.annotate({ description: "Source session ID to copy tasks from" }),
  taskIds: Schema.optional(Schema.Array(Schema.String)).annotate({ description: "Specific task IDs. Omit for all incomplete." }),
})

export const TodoCarryTool = Tool.define<typeof CarryParameters, { count: number }, Todo.Service>(
  "todo_carry",
  Effect.gen(function* () {
    const todo = yield* Todo.Service
    return {
      description: DESCRIPTION_CARRY,
      parameters: CarryParameters,
      execute: (params: { fromSessionId: string; taskIds?: string[] }, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const carried = yield* todo.carry({ fromSessionID: params.fromSessionId as SessionID, toSessionID: ctx.sessionID, taskIds: params.taskIds ?? [] })
          return { title: "Carry Forward", metadata: { count: carried.length }, output: [`Carried ${carried.length} tasks:`, "", ...formatTodos(carried)].join("\n") }
        }).pipe(Effect.orDie),
    }
  }),
)

export const ReflectParameters = Schema.Struct({
  summary: Schema.String.annotate({ description: "Summary of what was just completed or learned" }),
  patterns: Schema.optional(Schema.Array(Schema.String)).annotate({ description: "Key patterns or techniques discovered" }),
  skillName: Schema.optional(Schema.String).annotate({ description: "Name for the skill file to create (e.g. 'react-forms-debugging')" }),
})

export const ReflectTool = Tool.define<typeof ReflectParameters, { skillName: string; patterns: number }, AppFileSystem.Service>(
  "reflect",
  Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    return {
      description: DESCRIPTION_REFLECT,
      parameters: ReflectParameters,
      execute: (params: { summary: string; patterns?: string[]; skillName?: string }, _ctx: Tool.Context) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const name = params.skillName || `learned-${Date.now().toString(36)}`
          const skillsDir = path.join(instance.directory, "skills", name)
          yield* fs.writeWithDirs(path.join(skillsDir, "SKILL.md"), buildSkillContent(name, params.summary, params.patterns))
          const output = [`Skill created: skills/${name}/SKILL.md`, ``, `Summary: ${params.summary.slice(0, 200)}`]
          if (params.patterns?.length) { output.push("", "Patterns captured:", ...params.patterns.map((p) => `  - ${p}`)) }
          output.push("", "This skill will be auto-discovered in future sessions.")
          return { title: "Reflect: " + name, metadata: { skillName: name, patterns: params.patterns?.length ?? 0 }, output: output.join("\n") }
        }).pipe(Effect.orDie),
    }
  }),
)

export const ModelLearnParameters = Schema.Struct({
  concept: Schema.String.annotate({ description: "Concept or pattern name to learn" }),
  description: Schema.String.annotate({ description: "What was learned about this concept" }),
  relatedTo: Schema.optional(Schema.Array(Schema.String)).annotate({ description: "Related concepts or task IDs" }),
  confidence: Schema.optional(Schema.Literals(["low", "medium", "high"])).annotate({ description: "Confidence level. Default: medium" }),
})

export const ModelLearnTool = Tool.define<typeof ModelLearnParameters, { concept: string; confidence: string }, AppFileSystem.Service>(
  "model_learn",
  Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    return {
      description: DESCRIPTION_MODEL,
      parameters: ModelLearnParameters,
      execute: (params: { concept: string; description: string; relatedTo?: readonly string[]; confidence?: string }, _ctx: Tool.Context) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const modelDir = path.join(instance.directory, ".agence", "model")
          const modelFile = path.join(modelDir, "concepts.jsonl")

          // Store in learning database with embedding
          const learningId = yield* Effect.gen(function* () {
            return yield* storeLearning({
              projectId: instance.project.id,
              source: "model_learn",
              concept: params.concept,
              description: params.description,
              confidence: params.confidence ?? "medium",
              relatedTo: params.relatedTo ? [...params.relatedTo] : undefined,
            }).pipe(Effect.catch(() => Effect.succeed("")))
          }).pipe(Effect.orDie)

          // Also store in JSONL file for backwards compatibility
          let existing = ""
          const hasFile = yield* fs.existsSafe(modelFile)
          if (hasFile) existing = yield* fs.readFileString(modelFile).pipe(Effect.catch(() => Effect.succeed("")))

          const entry = JSON.stringify({
            concept: params.concept, description: params.description,
            relatedTo: params.relatedTo ?? [], confidence: params.confidence ?? "medium",
            learningId: learningId || undefined,
            timestamp: new Date().toISOString(),
          })
          yield* fs.writeWithDirs(modelFile, existing + (existing ? "\n" : "") + entry)
          return {
            title: `Learn: ${params.concept}`,
            metadata: { concept: params.concept, confidence: params.confidence ?? "medium" },
            output: `Learned concept "${params.concept}" (${params.confidence ?? "medium"} confidence). Stored in .agence/model/concepts.jsonl`,
          }
        }).pipe(Effect.orDie),
    }
  }),
)

function formatTodos(todos: Todo.Info[]): string[] {
  const topLevel = todos.filter((t) => !t.parentId)
  const byParent: Record<string, Todo.Info[]> = {}
  for (const t of todos) {
    if (t.parentId) {
      byParent[t.parentId] = byParent[t.parentId] || []
      byParent[t.parentId].push(t)
    }
  }
  const lines: string[] = []
  for (const t of topLevel) {
    const meta = formatMeta(t)
    lines.push(`- [${t.id}] ${t.content} (${t.status})${meta}`)
    if (t.description) lines.push(`    ${t.description.slice(0, 120)}`)
    const subs = byParent[t.id!]
    if (subs) {
      for (const s of subs) {
        const sm = formatMeta(s)
        lines.push(`  - [${s.id}] ${s.content} (${s.status})${sm}`)
        if (s.description) lines.push(`      ${s.description.slice(0, 120)}`)
      }
    }
  }
  return lines
}

function formatMeta(t: Todo.Info): string {
  const parts: string[] = []
  if (t.priority !== "medium") parts.push(`[${t.priority}]`)
  if (t.tags?.length) parts.push(t.tags.map((x) => `#${x}`).join(" "))
  if (t.dependsOn?.length) parts.push(`blocks: [${t.dependsOn.join(", ")}]`)
  return parts.length ? " " + parts.join(" ") : ""
}

function buildSkillContent(name: string, summary: string, patterns?: string[]): string {
  return [
    `---`,
    `name: ${name}`,
    `description: Auto-generated from task reflection: ${summary.slice(0, 120)}`,
    `---`,
    ``,
    `# ${name}`,
    ``,
    `## What was learned`,
    summary,
    ...(patterns?.length ? ["", "## Discovered patterns", ...patterns.map((p) => `- ${p}`)] : []),
    ``,
    `## When to use`,
    `This skill was automatically generated by the reflect tool after completing related work.`,
    ``,
    `## Usage history`,
    `- Created: ${new Date().toISOString()}`,
  ].join("\n")
}

// ═══ quality_gate ════════════════════════════════════════════════════════════

export const QGateParameters = Schema.Struct({
  taskRef: Schema.String.annotate({ description: "Reference to the task (title or id)" }),
  check: Schema.Literals(["typecheck", "test", "review", "deploy", "security", "custom"] as const).annotate({ description: "Type of quality check" }),
  passed: Schema.Boolean.annotate({ description: "Did the check pass?" }),
  output: Schema.optional(Schema.String).annotate({ description: "Error/output text from the check" }),
  details: Schema.optional(Schema.String).annotate({ description: "What was learned, or error patterns identified" }),
})

export const QualityGateTool = Tool.define<typeof QGateParameters, { check: string; passed: boolean; lessonsCount: number }, AppFileSystem.Service>(
  "quality_gate",
  Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    return {
      description: QGATE_DESC,
      parameters: QGateParameters,
      execute: (params: { taskRef: string; check: string; passed: boolean; output?: string; details?: string }, _ctx: Tool.Context) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const qualityDir = path.join(instance.directory, ".agence", "quality")
          const lessonsFile = path.join(qualityDir, "lessons.jsonl")

          // Read existing lessons
          let existing = ""
          if (yield* fs.existsSafe(lessonsFile)) {
            existing = yield* fs.readFileString(lessonsFile).pipe(Effect.catch(() => Effect.succeed("")))
          }

          // If it failed and there's error output, create a skill
          let skillPath = ""
          if (!params.passed && (params.output || params.details)) {
            const errors = params.output || ""
            const detail = params.details || ""
            const keyPatterns = extractPatterns(errors, detail)
            const skillName = `quality-${params.check}-${Date.now().toString(36)}`
            const skillDir = path.join(instance.directory, "skills", skillName)

            yield* fs.writeWithDirs(path.join(skillDir, "SKILL.md"), [
              `---`,
              `name: ${skillName}`,
              `description: Auto-generated from ${params.check} failure on "${params.taskRef.slice(0, 80)}"`,
              `---`,
              ``,
              `# Quality Gate: ${params.check}`,
              ``,
              `## Failed check`,
              `Task: ${params.taskRef}`,
              `Gate: ${params.check}`,
              ``,
              `## Error patterns`,
              ...keyPatterns.map((p) => `- ${p}`),
              ``,
              `## Full output`,
              "```",
              errors.slice(0, 2000),
              "```",
              ``,
              detail ? `## Notes\n${detail}\n` : "",
              `## When to use`,
              `This skill was automatically generated when a ${params.check} quality gate failed.`,
              `Reference it when encountering similar issues in the future.`,
              ``,
              `## Created`,
              `${new Date().toISOString()}`,
            ].join("\n"))
            skillPath = `skills/${skillName}/SKILL.md`
          }

          // Store in learning database with embedding
          yield* Effect.gen(function* () {
            yield* storeLearning({
              projectId: instance.project.id,
              source: "quality_gate",
              concept: `${params.check} failure: ${params.taskRef.slice(0, 80)}`,
              description: params.details || params.output?.slice(0, 500) || params.taskRef,
              confidence: params.passed ? "high" : "low",
              skillPath: skillPath || undefined,
              metadata: { taskRef: params.taskRef, check: params.check, passed: params.passed },
            }).pipe(Effect.catch(() => Effect.succeed("")))
          }).pipe(Effect.orDie)

          // Store the lesson
          const entry = JSON.stringify({
            taskRef: params.taskRef,
            check: params.check,
            passed: params.passed,
            output: params.output?.slice(0, 500),
            details: params.details,
            skillCreated: skillPath || undefined,
            timestamp: new Date().toISOString(),
          })
          yield* fs.writeWithDirs(lessonsFile, existing + (existing ? "\n" : "") + entry)

          // Count total lessons
          const allText = yield* fs.readFileString(lessonsFile).pipe(Effect.catch(() => Effect.succeed("")))
          const count = allText ? allText.trim().split("\n").length : 1

          const status = params.passed ? "PASSED" : "FAILED"
          const lines = [`${status}: ${params.check} gate for "${params.taskRef}"`]
          if (skillPath) lines.push(`Skill created: ${skillPath}`)
          lines.push(`Lessons stored: ${count} total`)

          return {
            title: `${status} ${params.check}`,
            metadata: { check: params.check, passed: params.passed, lessonsCount: count },
            output: lines.join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)

function extractPatterns(errors: string, details: string): string[] {
  const patterns: string[] = []
  if (details) patterns.push(details)

  if (errors.includes("TS") && errors.includes("error")) patterns.push("TypeScript compilation error detected")
  if (errors.includes("Cannot find module") || errors.includes("Module not found")) patterns.push("Missing module import")
  if (errors.includes("not assignable to type") || errors.includes("is not assignable")) patterns.push("Type mismatch - check interface alignment")
  if (errors.includes("null") || errors.includes("is not defined")) patterns.push("Null or missing value - check initialization")
  if (errors.includes("deprecated") || errors.includes("removed")) patterns.push("Using deprecated API - check for newer alternative")
  if (errors.includes("timeout") || errors.includes("ETIMEDOUT") || errors.includes("ECONNREFUSED")) patterns.push("Network/connection issue - check service availability")
  if (errors.includes("test") && errors.includes("fail")) patterns.push("Test failure - check test expectations and implementation")
  if (errors.includes("lint") || errors.includes("ESLint") || errors.includes("unused")) patterns.push("Code style/lint violation - check coding standards")

  return patterns.length > 0 ? patterns : ["Error detected - review the output for specific patterns"]
}

export { WriteParameters as Parameters }

// ═══ vector_search ═══════════════════════════════════════════════════════════

export const VSearchParameters = Schema.Struct({
  query: Schema.String.annotate({ description: "Search query to find related concepts and patterns" }),
  source: Schema.optional(Schema.String).annotate({ description: "Filter by source: reflect, model_learn, quality_gate" }),
  limit: Schema.optional(Schema.Number).annotate({ description: "Max results (default 10)" }),
})

export const VectorSearchTool = Tool.define<typeof VSearchParameters, { count: number }, any>(
  "vector_search",
  Effect.gen(function* () {
    return {
      description: `Search your project's knowledge base using semantic similarity. Finds related concepts stored by reflect, model_learn, and quality_gate. Uses local embeddings (nomic-embed-text via Ollama) for understanding meaning, not just keyword matching.`,
      parameters: VSearchParameters,
      execute: (params: { query: string; source?: string; limit?: number }, _ctx: Tool.Context) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const results = yield* searchLearnings({
            projectId: instance.project.id,
            query: params.query,
            limit: params.limit ?? 10,
          }).pipe(Effect.catch(() => Effect.succeed([])))

          if (results.length === 0) {
            return { title: "Vector Search", metadata: { count: 0 }, output: `No results found for "${params.query}". Try model_learn to create concepts first.` }
          }

          const lines = [`Found ${results.length} results for "${params.query}":`, ""]
          for (const r of results) {
            const score = r.score ? ` (${(r.score * 100).toFixed(0)}% match)` : ""
            lines.push(`## ${r.concept} [${r.source}]${score}`)
            lines.push(`  ${r.description.slice(0, 200)}`)
            if (r.skillPath) lines.push(`  Skill: ${r.skillPath}`)
            if (r.confidence !== "medium") lines.push(`  Confidence: ${r.confidence}`)
            lines.push("")
          }

          return {
            title: `Vector Search: ${params.query}`,
            metadata: { count: results.length },
            output: lines.join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)
