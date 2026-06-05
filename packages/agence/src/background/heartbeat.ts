import { Effect, Option } from "effect"
import { Session } from "@/session/session"
import { SessionPrompt } from "@/session/prompt"
import { InstanceRef } from "@/effect/instance-ref"
import { InstanceState } from "@/effect/instance-state"
import fs from "fs/promises"
import path from "path"

export interface HeartbeatTask {
  interval: string
  intervalMs: number
  taskName: string
  prompt: string
}

const lineRegex = /-\s*\[\s*([xX ])\s*\]\s*[eE]very\s+(\d+[mhd]):\s*([a-zA-Z0-9_-]+)\s*\|\s*(.+)$/i

export type HeartbeatTaskRow = HeartbeatTask & {
  enabled: boolean
}

export function formatHeartbeatLine(input: {
  enabled: boolean
  interval: string
  taskName: string
  prompt: string
}) {
  const mark = input.enabled ? " " : "x"
  return `- [${mark}] Every ${input.interval}: ${input.taskName} | ${input.prompt}`
}

export function parseHeartbeatTasks(content: string): HeartbeatTaskRow[] {
  const tasks: HeartbeatTaskRow[] = []
  const lines = content.split("\n")
  for (const line of lines) {
    const match = line.match(lineRegex)
    if (!match) continue
    const enabled = match[1].trim().toLowerCase() !== "x"
    tasks.push({
      enabled,
      interval: match[2],
      intervalMs: parseInterval(match[2]),
      taskName: match[3],
      prompt: match[4].trim(),
    })
  }
  return tasks
}

export function serializeHeartbeatContent(
  tasks: readonly { enabled: boolean; interval: string; taskName: string; prompt: string }[],
  existing = "",
) {
  const lines = existing.split("\n")
  const header = lines.filter((line) => !line.match(lineRegex))
  const trimmedHeader = header.join("\n").trimEnd()
  const taskLines = tasks.map((task) => formatHeartbeatLine(task))
  if (!trimmedHeader && taskLines.length === 0) return ""
  if (!trimmedHeader) return `${taskLines.join("\n")}\n`
  if (taskLines.length === 0) return `${trimmedHeader}\n`
  return `${trimmedHeader}\n\n${taskLines.join("\n")}\n`
}

export const defaultHeartbeatTemplate = `# Heartbeat

Background tasks for this project. Use \`- [ ]\` for active tasks and \`- [x]\` to pause.

- [ ] Every 1d: memory-maintenance | fn:memory-maintenance
`

function parseInterval(str: string): number {
  const num = parseInt(str, 10)
  const unit = str.slice(-1).toLowerCase()
  if (unit === "m") return num * 60 * 1000
  if (unit === "h") return num * 60 * 60 * 1000
  if (unit === "d") return num * 24 * 60 * 60 * 1000
  return num * 1000
}

export function loadHeartbeatRuns(directory: string): Effect.Effect<Record<string, number>> {
  return Effect.promise(async () => {
    const filePath = path.join(directory, ".agence", "heartbeat.json")
    try {
      const data = await fs.readFile(filePath, "utf-8")
      return JSON.parse(data) as Record<string, number>
    } catch {
      return {} as Record<string, number>
    }
  })
}

export function saveHeartbeatRun(directory: string, taskName: string, timestamp: number): Effect.Effect<void> {
  return Effect.promise(async () => {
    const filePath = path.join(directory, ".agence", "heartbeat.json")
    try {
      let current: Record<string, number> = {}
      try {
        const data = await fs.readFile(filePath, "utf-8")
        current = JSON.parse(data)
      } catch {}
      current[taskName] = timestamp
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, JSON.stringify(current, null, 2), "utf-8")
    } catch {}
  })
}

type HeartbeatAction =
  | { kind: "agent"; prompt: string }
  | { kind: "cmd"; command: string }
  | { kind: "fn"; name: "memory-maintenance" | "memory-export" | "skill-opt" }
  | { kind: "fn"; name: "memory-ingest-doc"; docPath: string }

function parseAction(prompt: string): HeartbeatAction {
  const p = prompt.trim()
  if (p.toLowerCase().startsWith("cmd:")) return { kind: "cmd", command: p.slice(4).trim() }
  if (p.toLowerCase().startsWith("fn:")) {
    const rest = p.slice(3).trim()
    const [rawName, ...rawArgs] = rest.split(/\s+/)
    const name = (rawName ?? "").toLowerCase()
    if (name === "memory-maintenance") return { kind: "fn", name: "memory-maintenance" }
    if (name === "memory-export") return { kind: "fn", name: "memory-export" }
    if (name === "skill-opt") return { kind: "fn", name: "skill-opt" }
    if (name === "memory-ingest-doc") return { kind: "fn", name: "memory-ingest-doc", docPath: rawArgs.join(" ").trim() }
  }
  return { kind: "agent", prompt: p }
}

function runCommand(directory: string, command: string) {
  return Effect.promise(async () => {
    const timeoutMs = 5 * 60 * 1000
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const isWin = process.platform === "win32"
      const proc = Bun.spawn(
        isWin ? ["powershell", "-NoProfile", "-Command", command] : ["bash", "-lc", command],
        { cwd: directory, stdout: "pipe", stderr: "pipe", signal: controller.signal },
      )
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ])
      return { exitCode, stdout: stdout.slice(0, 8000), stderr: stderr.slice(0, 8000) }
    } finally {
      clearTimeout(timer)
    }
  })
}

export function startHeartbeatLoop() {
  return Effect.gen(function* () {
    const ctx = yield* InstanceState.context
    const heartbeatPath = path.join(ctx.directory, "HEARTBEAT.md")

    const sessionOpt = yield* Effect.serviceOption(Session.Service)
    const promptOpt = yield* Effect.serviceOption(SessionPrompt.Service)

    if (Option.isNone(sessionOpt) || Option.isNone(promptOpt)) {
      yield* Effect.logInfo("[Heartbeat] Session services not available in context; skipping background scheduler startup")
      return
    }

    const session = sessionOpt.value
    const promptSvc = promptOpt.value

    const runTasks = Effect.gen(function* () {
      const content = yield* Effect.promise(async () => {
        try {
          return await fs.readFile(heartbeatPath, "utf-8")
        } catch {
          return ""
        }
      })
      if (!content.trim()) return

      const tasks = parseHeartbeatTasks(content)
      if (tasks.length === 0) return

      const runs = yield* loadHeartbeatRuns(ctx.directory)
      const now = Date.now()

      for (const task of tasks) {
        if (!task.enabled) continue
        const lastRun = runs[task.taskName] ?? 0
        if (now - lastRun < task.intervalMs) continue

        yield* Effect.logInfo(`[Heartbeat] Running task: ${task.taskName}`)
        yield* saveHeartbeatRun(ctx.directory, task.taskName, now)

        const action = parseAction(task.prompt)
        if (action.kind === "cmd") {
          const result = yield* runCommand(ctx.directory, action.command).pipe(
            Effect.catch(() => Effect.succeed({ exitCode: -1, stdout: "", stderr: "command failed or timed out" })),
          )
          yield* Effect.logInfo(
            `[Heartbeat] cmd:${task.taskName} exit=${result.exitCode} stdout=${result.stdout.length}B stderr=${result.stderr.length}B`,
          )
          continue
        }

        if (action.kind === "fn") {
          if (action.name === "memory-maintenance") {
            const { runMemoryMaintenance } = yield* Effect.promise(() => import("@/learning/memory-intelligence"))
            yield* runMemoryMaintenance(ctx.project.id).pipe(Effect.catch(() => Effect.void))
            continue
          }
          if (action.name === "memory-export") {
            const { exportProjectMemories } = yield* Effect.promise(() => import("@/learning/memory-intelligence"))
            yield* exportProjectMemories(ctx.project.id).pipe(Effect.catch(() => Effect.void))
            continue
          }
          if (action.name === "memory-ingest-doc") {
            if (!action.docPath) continue
            const { ingestMarkdownDocToMemory } = yield* Effect.promise(() => import("@/learning/memory-intelligence"))
            yield* ingestMarkdownDocToMemory({
              projectId: ctx.project.id,
              directory: ctx.directory,
              docPath: action.docPath,
              layer: "experience",
              tags: ["knowledge", "debug", "fix", "ui", "workflow"],
            }).pipe(Effect.catch(() => Effect.void))
            continue
          }
          if (action.name === "skill-opt") {
            const { runSkillOptMaintenance } = yield* Effect.promise(() => import("@/learning/skill-opt"))
            yield* runSkillOptMaintenance().pipe(Effect.catch(() => Effect.void))
            continue
          }
        }

        yield* session
          .create({
            title: `Heartbeat: ${task.taskName}`,
            agent: "heartbeat",
          })
          .pipe(
            Effect.flatMap((newSession) =>
              promptSvc.prompt({
                sessionID: newSession.id,
                parts: [{ type: "text", text: action.kind === "agent" ? action.prompt : task.prompt }],
              }),
            ),
            Effect.catch(() => {
              console.error(`[Heartbeat] Task ${task.taskName} failed`)
              return Effect.void
            }),
          )
      }
    })

    const loop = runTasks.pipe(
      Effect.catch(() => {
        console.error("[Heartbeat] Error checking heartbeat tasks")
        return Effect.void
      }),
      Effect.delay("30 seconds"),
      Effect.forever,
    )

    yield* loop.pipe(Effect.provideService(InstanceRef, ctx), Effect.forkDetach)
    yield* Effect.logInfo("[Heartbeat] Background scheduler loop successfully running")
  })
}
