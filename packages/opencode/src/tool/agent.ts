import { Effect, Schema } from "effect"
import { InstanceState } from "@/effect/instance-state"
import { AppFileSystem } from "@opencode-ai/core/filesystem"
import path from "path"
import * as Tool from "./tool"
import { Todo } from "../session/todo"

// ═══ daily_brief ════════════════════════════════════════════════════════════

export const BriefParameters = Schema.Struct({
  scope: Schema.optional(Schema.Literals(["today", "week", "project"] as const)).annotate({ description: "Brief scope: today, week, or project overview (default: today)" }),
})

export const DailyBriefTool = Tool.define<typeof BriefParameters, { scope: string }, Todo.Service>(
  "daily_brief",
  Effect.gen(function* () {
    const todo = yield* Todo.Service
    return {
      description: "Generate a daily or weekly brief of what's been done, what's in progress, and what's learned. Summarizes tasks, quality gates, and recent learnings into a structured report.",
      parameters: BriefParameters,
      execute: (params: { scope?: string }, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const scope = params.scope ?? "today"
          const todos = yield* todo.getAll()

          const active = todos.filter((t) => t.status === "in_progress")
          const pending = todos.filter((t) => t.status === "pending")
          const completed = todos.filter((t) => t.status === "completed")
          const cancelled = todos.filter((t) => t.status === "cancelled")

          const lines = [`## ${scope === "week" ? "Weekly" : "Daily"} Brief`, ""]
          lines.push(`### Tasks (${todos.length} total)`)
          if (active.length) lines.push(`In Progress (${active.length}):`, ...active.map((t) => `  - [${t.id}] ${t.content}`), "")
          if (pending.length) lines.push(`Pending (${pending.length}):`, ...pending.slice(0, 5).map((t) => `  - [${t.id}] ${t.content} ${t.tags ? t.tags.map((x) => `#${x}`).join(" ") : ""}`), pending.length > 5 ? `  ... and ${pending.length - 5} more` : "", "")
          if (completed.length) lines.push(`Completed (${completed.length}):`, ...completed.slice(-3).map((t) => `  - ${t.content}`), "")
          if (cancelled.length) lines.push(`Cancelled (${cancelled.length})`, "")

          // Tags summary
          const allTags = todos.flatMap((t) => t.tags ?? [])
          if (allTags.length) {
            const counts: Record<string, number> = {}
            allTags.forEach((tag) => { counts[tag] = (counts[tag] ?? 0) + 1 })
            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
            lines.push(`### Tags`, sorted.map(([tag, count]) => `  #${tag}: ${count}`).join("\n"), "")
          }

          lines.push(`Session: ${ctx.sessionID}`)
          lines.push(`Generated: ${new Date().toISOString()}`)

          return {
            title: `${scope === "week" ? "Weekly" : "Daily"} Brief`,
            metadata: { scope, activeTasks: active.length, completedTasks: completed.length },
            output: lines.join("\n"),
          }
        }),
    }
  }),
)

// ═══ task_schedule ═════════════════════════════════════════════════════════

export const ScheduleParameters = Schema.Struct({
  action: Schema.Literals(["add", "list", "remove"] as const).annotate({ description: "Schedule action: add, list, or remove" }),
  name: Schema.optional(Schema.String).annotate({ description: "Name for this schedule (required for add/remove)" }),
  cron: Schema.optional(Schema.String).annotate({ description: "Cron expression like '0 8 * * *' for daily at 8am, '*/30 * * * *' for every 30min" }),
  tool: Schema.optional(Schema.String).annotate({ description: "Tool to run (e.g. daily_brief, reflect)" }),
  params: Schema.optional(Schema.String).annotate({ description: "JSON params for the tool" }),
})

export const TaskScheduleTool = Tool.define<typeof ScheduleParameters, { action: string; count?: number }, AppFileSystem.Service>(
  "task_schedule",
  Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    return {
      description: "Schedule tools to run automatically on a cron schedule. Supports cron expressions like '0 8 * * *' (daily at 8am), '*/30 * * * *' (every 30min). Use task_schedule list to see active schedules.",
      parameters: ScheduleParameters,
      execute: (params: { action: string; name?: string; cron?: string; tool?: string; params?: string }, _ctx: Tool.Context) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const schedDir = path.join(instance.directory, ".agence", "schedules")
          const schedFile = path.join(schedDir, "schedules.json")

          if (params.action === "list") {
            const exists = yield* fs.existsSafe(schedFile)
            if (!exists) return { title: "Schedules", metadata: { action: "list", count: 0 }, output: "No schedules found." }
            const raw = yield* fs.readFileString(schedFile)
            const data = JSON.parse(raw) as Array<Record<string, unknown>>
            if (data.length === 0) return { title: "Schedules", metadata: { action: "list", count: 0 }, output: "No schedules found." }
            const lines = [`${data.length} active schedules:`, ""]
            for (const s of data) {
              lines.push(`  ${s.name}: ${s.cron} → ${s.tool} ${s.params ? JSON.stringify(s.params) : ""}`)
            }
            return { title: "Schedules", metadata: { action: "list", count: data.length }, output: lines.join("\n") }
          }

          if (params.action === "remove") {
            if (!params.name) return { title: "Schedule", metadata: { action: "remove" }, output: "name required for remove." }
            const exists = yield* fs.existsSafe(schedFile)
            if (!exists) return { title: "Schedule", metadata: { action: "remove" }, output: `No schedules found.` }
            const raw = yield* fs.readFileString(schedFile)
            const data = JSON.parse(raw) as Array<Record<string, unknown>>
            const filtered = data.filter((s: Record<string, unknown>) => s.name !== params.name)
            yield* fs.writeWithDirs(schedFile, JSON.stringify(filtered, null, 2))
            return { title: "Schedule", metadata: { action: "remove" }, output: `Removed schedule: ${params.name}. Run task_schedule action=list to verify.` }
          }

          if (params.action === "add") {
            if (!params.name || !params.cron || !params.tool) {
              return { title: "Schedule", metadata: { action: "add" }, output: "name, cron, and tool are required. Example: task_schedule action=add name=daily-brief cron='0 8 * * *' tool=daily_brief" }
            }
            const entry = { name: params.name, cron: params.cron, tool: params.tool, params: params.params ? JSON.parse(params.params) : {}, created: new Date().toISOString() }
            const exists = yield* fs.existsSafe(schedFile)
            let data: Array<Record<string, unknown>> = []
            if (exists) {
              const raw = yield* fs.readFileString(schedFile)
              try { data = JSON.parse(raw) as Array<Record<string, unknown>> } catch { data = [] }
            }
            data.push(entry)
            yield* fs.writeWithDirs(schedFile, JSON.stringify(data, null, 2))
            return {
              title: `Schedule: ${params.name}`,
              metadata: { action: "add", count: data.length },
              output: [
                `✅ Scheduled: ${params.name}`,
                `  Cron: ${params.cron}`,
                `  Tool: ${params.tool}`,
                `  ${data.length} total schedules.`,
                "",
                "Schedules run when the agent is active. Use task_schedule action=list to view all.",
              ].join("\n"),
            }
          }

          return { title: "Schedule", metadata: { action: params.action }, output: `Unknown action: ${params.action}. Use add, list, or remove.` }
        }).pipe(Effect.orDie),
    }
  }),
)

// ═══ self_iterate ══════════════════════════════════════════════════════════

export const IterateParameters = Schema.Struct({
  topic: Schema.String.annotate({ description: "What to reflect on (e.g. 'typecheck failures', 'code quality', 'project structure')" }),
  patterns: Schema.optional(Schema.Array(Schema.String)).annotate({ description: "Patterns or observations noticed" }),
  createSkill: Schema.optional(Schema.Boolean).annotate({ description: "Create a SKILL.md with the insights (default: true)" }),
})

export const SelfIterateTool = Tool.define<typeof IterateParameters, { patterns: number }, AppFileSystem.Service>(
  "self_iterate",
  Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    return {
      description: "Reflect on recent work and generate self-improvement insights. Reviews what was done, identifies patterns, and creates actionable improvements. Use at the end of complex tasks or when noticing recurring issues.",
      parameters: IterateParameters,
      execute: (params: { topic: string; patterns?: readonly string[]; createSkill?: boolean }, _ctx: Tool.Context) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const pats = params.patterns ?? []
          const skillName = `self-improvement-${Date.now().toString(36)}`
          const lines = [`## Self-Iteration: ${params.topic}`, ""]
          lines.push(`### Observations (${pats.length})`)
          pats.forEach((p) => lines.push(`  - ${p}`))
          lines.push("")

          if (params.createSkill !== false && pats.length > 0) {
            const skillDir = path.join(instance.directory, "skills", skillName)
            yield* fs.writeWithDirs(path.join(skillDir, "SKILL.md"), [
              `---`,
              `name: ${skillName}`,
              `description: Self-improvement from: ${params.topic.slice(0, 120)}`,
              `---`,
              ``,
              `# Self-Improvement: ${params.topic}`,
              ``,
              `## Patterns identified`,
              ...pats.map((p) => `- ${p}`),
              ``,
              `## Action items`,
              `1. Apply these patterns in future work`,
              `2. Reference this skill when encountering similar situations`,
              ``,
              `## Created`,
              `${new Date().toISOString()}`,
            ].join("\n"))
            lines.push(`Skill created: skills/${skillName}/SKILL.md`)
            lines.push("")
          }

          lines.push("Reflection complete. These insights will be available in future sessions via the skills system.")

          return {
            title: `Self-Iteration: ${params.topic}`,
            metadata: { patterns: pats.length },
            output: lines.join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)

// ═══ eval_run ══════════════════════════════════════════════════════════════

export const EvalParameters = Schema.Struct({
  testCase: Schema.String.annotate({ description: "Description of what to test (e.g. 'Verify read tool handles missing files correctly')" }),
  expected: Schema.String.annotate({ description: "Expected outcome or behavior" }),
  result: Schema.optional(Schema.String).annotate({ description: "Actual result (leave empty, it will be filled during evaluation)" }),
  score: Schema.optional(Schema.Literals(["pass", "fail", "partial"] as const)).annotate({ description: "Evaluation score" }),
})

export const EvalRunTool = Tool.define<typeof EvalParameters, { score: string }, AppFileSystem.Service>(
  "eval_run",
  Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    return {
      description: "Run an evaluation test case and record the result. Use to benchmark agent behavior against expected outcomes. Results are stored in .agence/eval/ for trend analysis.",
      parameters: EvalParameters,
      execute: (params: { testCase: string; expected: string; result?: string; score?: string }, _ctx: Tool.Context) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const evalDir = path.join(instance.directory, ".agence", "eval")
          const evalFile = path.join(evalDir, "results.jsonl")

          const entry = JSON.stringify({
            testCase: params.testCase, expected: params.expected,
            result: params.result ?? "(pending)", score: params.score ?? "pending",
            timestamp: new Date().toISOString(),
          })

          let existing = ""
          if (yield* fs.existsSafe(evalFile)) {
            existing = yield* fs.readFileString(evalFile).pipe(Effect.catch(() => Effect.succeed("")))
          }
          yield* fs.writeWithDirs(evalFile, existing + (existing ? "\n" : "") + entry)

          return {
            title: `Eval: ${params.score ?? "pending"}`,
            metadata: { score: params.score ?? "pending" },
            output: [
              `## Eval: ${params.testCase}`,
              `Expected: ${params.expected}`,
              `Result: ${params.result ?? "(pending)"}`,
              `Score: ${params.score ?? "pending"}`,
              "",
              `Log: .agence/eval/results.jsonl`,
            ].join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)
