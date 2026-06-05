import path from "path"
import { Effect, Schema } from "effect"
import { AppFileSystem } from "@agence-ai/core/filesystem"
import { Session } from "./session"
import { MessageV2 } from "./message-v2"
import { MessageID, PartID, type SessionID } from "./schema"
import { loadManifest, saveManifest } from "@/project/manifest"
import PROMPT_GOAL_REMINDER from "./prompt/goal-reminder.txt"
import PROMPT_GOAL_CONTINUE from "./prompt/goal-continue.txt"

export const DEFAULT_BUDGET = 20

export const Status = Schema.Literals(["active", "paused", "complete", "budget_limited"] as const)
export type Status = Schema.Schema.Type<typeof Status>

export const State = Schema.Struct({
  objective: Schema.String,
  status: Status,
  budget: Schema.optional(Schema.Number),
  continuationCount: Schema.optional(Schema.Number),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
  completedAt: Schema.optional(Schema.Number),
  blockedReason: Schema.optional(Schema.String),
  completionEvidence: Schema.optional(Schema.String),
})
export type State = Schema.Schema.Type<typeof State>

export type GoalAction =
  | { type: "show" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "clear" }
  | { type: "set"; objective: string }

export function parseGoalArgs(raw: string): GoalAction {
  const trimmed = raw.trim()
  if (!trimmed) return { type: "show" }
  const head = trimmed.split(/\s+/)[0]?.toLowerCase()
  if (head === "pause") return { type: "pause" }
  if (head === "resume") return { type: "resume" }
  if (head === "clear") return { type: "clear" }
  return { type: "set", objective: trimmed }
}

export function goalPath(worktree: string) {
  return path.join(worktree, ".agence", "goal.json")
}

export function loadGoal(worktree: string) {
  return Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    const file = goalPath(worktree)
    if (!(yield* fs.existsSafe(file))) return undefined
    const raw = yield* fs.readFileString(file).pipe(Effect.catch(() => Effect.succeed("")))
    if (!raw.trim()) return undefined
    const parsed = Schema.decodeUnknownOption(State)(JSON.parse(raw))
    return parsed._tag === "Some" ? parsed.value : undefined
  })
}

export function saveGoal(worktree: string, state: State) {
  return Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    const file = goalPath(worktree)
    yield* fs.ensureDir(path.dirname(file))
    yield* fs.writeFileString(file, JSON.stringify(state, null, 2))
  })
}

export function clearGoal(worktree: string) {
  return Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    const file = goalPath(worktree)
    if (yield* fs.existsSafe(file)) yield* fs.remove(file).pipe(Effect.catch(() => Effect.void))
  })
}

export function loadProjectGoal(directory: string) {
  return loadManifest(directory).pipe(
    Effect.map((manifest) => manifest.goal?.trim() || undefined),
    Effect.catch(() => Effect.succeed(undefined)),
  )
}

/** Keep `.agence/goal.json` aligned with `project.json` goal for this project. */
export function syncFromManifest(directory: string, worktree: string) {
  return Effect.gen(function* () {
    const objective = yield* loadProjectGoal(directory)
    const current = yield* loadGoal(worktree)
    const now = Date.now()

    if (!objective) {
      if (current) yield* clearGoal(worktree)
      return undefined
    }

    if (!current || current.objective !== objective) {
      const next: State = {
        objective,
        status: "active",
        budget: current?.budget ?? DEFAULT_BUDGET,
        continuationCount: 0,
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
      }
      yield* saveGoal(worktree, next)
      return next
    }

    if (current.status === "complete" || current.status === "budget_limited") {
      const next: State = {
        ...current,
        status: "active",
        continuationCount: 0,
        updatedAt: now,
        completedAt: undefined,
        blockedReason: undefined,
        completionEvidence: undefined,
      }
      yield* saveGoal(worktree, next)
      return next
    }

    return current
  })
}

export function resolveGoal(directory: string, worktree: string) {
  return syncFromManifest(directory, worktree)
}

export function formatGoalStatus(state: State | undefined) {
  if (!state) {
    return "No project Goal set. Add one in Project Hub → Goal, or use `/goal <outcome verified by evidence while preserving constraints>`."
  }
  const budget = state.budget ?? DEFAULT_BUDGET
  const used = state.continuationCount ?? 0
  const lines = [
    `Status: ${state.status}`,
    `Objective: ${state.objective}`,
    `Auto-continue budget: ${used}/${budget}`,
  ]
  if (state.blockedReason?.trim()) lines.push(`Blocked: ${state.blockedReason.trim()}`)
  if (state.completionEvidence?.trim()) lines.push(`Evidence: ${state.completionEvidence.trim()}`)
  return lines.join("\n")
}

export function syntheticReminder(state: State) {
  return PROMPT_GOAL_REMINDER.replace("${objective}", state.objective).replace("${projectGoalBlock}", "")
}

export function applyAction(input: {
  directory: string
  worktree: string
  action: GoalAction
}) {
  return Effect.gen(function* () {
    const now = Date.now()
    yield* syncFromManifest(input.directory, input.worktree)
    const current = yield* loadGoal(input.worktree)

    if (input.action.type === "show") {
      return { state: current, message: formatGoalStatus(current), startWork: false }
    }

    if (input.action.type === "clear") {
      yield* clearGoal(input.worktree)
      const manifest = yield* loadManifest(input.directory)
      yield* saveManifest(input.directory, { ...manifest, goal: undefined })
      return { state: undefined, message: "Project Goal cleared.", startWork: false }
    }

    if (input.action.type === "pause") {
      if (!current) return { state: undefined, message: "No project Goal to pause.", startWork: false }
      const next: State = { ...current, status: "paused", updatedAt: now }
      yield* saveGoal(input.worktree, next)
      return { state: next, message: "Project Goal paused.", startWork: false }
    }

    if (input.action.type === "resume") {
      if (!current) {
        return {
          state: undefined,
          message: "No project Goal to resume. Set one in Project Hub or with `/goal <objective>`.",
          startWork: false,
        }
      }
      const next: State = { ...current, status: "active", updatedAt: now, blockedReason: undefined }
      yield* saveGoal(input.worktree, next)
      return {
        state: next,
        message: `Project Goal resumed.\n\n${formatGoalStatus(next)}`,
        startWork: true,
      }
    }

    const objective = input.action.objective.trim()
    const manifest = yield* loadManifest(input.directory)
    yield* saveManifest(input.directory, { ...manifest, goal: objective })
    const next: State = {
      objective,
      status: "active",
      budget: current?.budget ?? DEFAULT_BUDGET,
      continuationCount: 0,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    }
    yield* saveGoal(input.worktree, next)
    return {
      state: next,
      message: `Project Goal activated.\n\n${formatGoalStatus(next)}`,
      startWork: true,
    }
  })
}

export function markComplete(input: {
  worktree: string
  evidence: string
  blocked?: boolean
  blockedReason?: string
}) {
  return Effect.gen(function* () {
    const current = yield* loadGoal(input.worktree)
    if (!current) return { ok: false as const, message: "No active project Goal." }
    const now = Date.now()
    const next: State = {
      ...current,
      status: "complete",
      updatedAt: now,
      completedAt: now,
      completionEvidence: input.evidence,
      blockedReason: input.blocked ? input.blockedReason ?? input.evidence : undefined,
    }
    yield* saveGoal(input.worktree, next)
    return {
      ok: true as const,
      message: input.blocked
        ? `Goal marked blocked: ${input.blockedReason ?? input.evidence}`
        : `Goal marked complete. Evidence: ${input.evidence}`,
    }
  })
}

function assistantHadToolCalls(assistant: MessageV2.WithParts) {
  return assistant.parts.some((part) => part.type === "tool")
}

export function shouldAutoContinue(input: {
  directory: string
  worktree: string
  messages: MessageV2.WithParts[]
  assistant: MessageV2.WithParts
}) {
  return Effect.gen(function* () {
    const state = yield* resolveGoal(input.directory, input.worktree)
    if (!state || state.status !== "active") return false

    const info = input.assistant.info
    if (info.role !== "assistant") return false
    if (info.error) return false
    if (info.finish && ["tool-calls", "unknown"].includes(info.finish)) return false

    const lastUser = input.messages.findLast((msg) => msg.info.role === "user")
    const wasGoalContinue = lastUser?.parts.some(
      (part) => part.type === "text" && part.synthetic && part.text.includes("Goal is still active"),
    )
    if (wasGoalContinue && !assistantHadToolCalls(input.assistant)) return false

    const budget = state.budget ?? DEFAULT_BUDGET
    const used = state.continuationCount ?? 0
    if (used >= budget) {
      yield* saveGoal(input.worktree, {
        ...state,
        status: "budget_limited",
        updatedAt: Date.now(),
      })
      return false
    }

    return true
  })
}

export function injectContinuation(input: {
  directory: string
  worktree: string
  sessionID: SessionID
  session: Session.Info
  assistant: MessageV2.Assistant
}) {
  return Effect.gen(function* () {
    const sessions = yield* Session.Service
    const state = yield* resolveGoal(input.directory, input.worktree)
    if (!state || state.status !== "active") return

    const lastUser = yield* sessions
      .findMessage(input.sessionID, (msg) => msg.info.role === "user" && !!msg.info.model)
      .pipe(Effect.orDie)
    const model =
      lastUser._tag === "Some" && lastUser.value.info.role === "user" && lastUser.value.info.model
        ? lastUser.value.info.model
        : input.session.model
          ? {
              providerID: input.session.model.providerID,
              modelID: input.session.model.id,
            }
          : undefined
    if (!model) return

    const used = (state.continuationCount ?? 0) + 1
    yield* saveGoal(input.worktree, {
      ...state,
      continuationCount: used,
      updatedAt: Date.now(),
    })

    const msg: MessageV2.User = {
      id: MessageID.ascending(),
      sessionID: input.sessionID,
      role: "user",
      time: { created: Date.now() },
      agent: input.assistant.agent ?? input.session.agent ?? "build",
      model,
    }
    yield* sessions.updateMessage(msg)
    yield* sessions.updatePart({
      id: PartID.ascending(),
      messageID: msg.id,
      sessionID: input.sessionID,
      type: "text",
      text: PROMPT_GOAL_CONTINUE.replace("${objective}", state.objective),
      synthetic: true,
    })
  })
}

export * as SessionGoal from "./goal"
