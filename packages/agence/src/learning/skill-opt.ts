import { createHash } from "node:crypto"
import { stat } from "node:fs/promises"
import path from "path"
import { Effect } from "effect"
import { generateText } from "ai"
import { AppFileSystem } from "@agence-ai/core/filesystem"
import { InstanceState } from "@/effect/instance-state"
import { Provider } from "@/provider/provider"
import { Session } from "@/session/session"
import type { SessionID } from "@/session/schema"
import {
  defaultSkillOptSettings,
  loadSkillOptSettings,
  type SkillOptSettings,
} from "./skill-opt-settings"

export type SkillEdit =
  | { op: "add"; section: string; content: string }
  | { op: "delete"; section: string }
  | { op: "replace"; section: string; content: string }

export type SkillOptState = {
  rejected: { skill: string; edits: SkillEdit[]; reason: string; at: number }[]
  accepted: { skill: string; summary: string; at: number }[]
  skills: Record<string, { version: number; path: string; hash: string }>
}

export type DiscoveredSkill = {
  name: string
  path: string
  content: string
}

const defaultState: SkillOptState = { rejected: [], accepted: [], skills: {} }

function statePath(directory: string) {
  return path.join(directory, ".agence", "skill-opt-state.json")
}

function bestSkillPath(directory: string, name: string) {
  return path.join(directory, ".agence", "skills", "best", `${name}.md`)
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function hashContent(content: string) {
  return createHash("sha256").update(content).digest("hex").slice(0, 16)
}

function editsKey(skill: string, edits: SkillEdit[]) {
  return `${skill}:${JSON.stringify(edits)}`
}

export function applySkillEdits(content: string, edits: SkillEdit[], maxDeltaChars: number) {
  let result = content
  let delta = 0

  for (const edit of edits) {
    const before = result
    if (edit.op === "add") {
      result = `${result.trimEnd()}\n\n## ${edit.section}\n\n${edit.content.trim()}\n`
    }
    if (edit.op === "delete") {
      const pattern = new RegExp(`^##\\s+${escapeRegex(edit.section)}[\\s\\S]*?(?=^##\\s|$)`, "im")
      result = `${result.replace(pattern, "").trimEnd()}\n`
    }
    if (edit.op === "replace") {
      const pattern = new RegExp(`^##\\s+${escapeRegex(edit.section)}[\\s\\S]*?(?=^##\\s|$)`, "im")
      const replacement = `## ${edit.section}\n\n${edit.content.trim()}\n\n`
      result = pattern.test(result) ? result.replace(pattern, replacement) : `${result.trimEnd()}\n\n${replacement}`
    }
    delta += Math.abs(result.length - before.length)
    if (delta > maxDeltaChars) return { ok: false as const, reason: "edit budget exceeded", content: before, delta }
  }

  return { ok: true as const, content: result, delta }
}

export function validateSkillDocument(content: string) {
  const trimmed = content.trim()
  if (trimmed.length < 80) return { ok: false as const, reason: "too short" }
  if (trimmed.length > 12000) return { ok: false as const, reason: "too long" }
  if (!trimmed.startsWith("---")) return { ok: false as const, reason: "missing frontmatter" }
  if (!/^#\s+/m.test(trimmed)) return { ok: false as const, reason: "missing title" }
  return { ok: true as const }
}

function sessionTrajectory(messages: { info: { role: string }; parts: { type: string; text?: string; value?: string }[] }[]) {
  return messages
    .slice(-12)
    .map((message) => {
      const text = message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text ?? part.value ?? "")
        .join("\n")
      return `${message.info.role.toUpperCase()}: ${text}`
    })
    .join("\n\n")
}

async function discoverProjectSkills(directory: string) {
  const roots = [
    path.join(directory, "skills"),
    path.join(directory, ".opencode", "skills"),
    path.join(directory, ".agents", "skills"),
    path.join(directory, ".agence", "skills"),
  ]
  const found: DiscoveredSkill[] = []
  const seen = new Set<string>()

  for (const root of roots) {
    const isDir = await stat(root).then((info) => info.isDirectory()).catch(() => false)
    if (!isDir) continue
    const glob = new Bun.Glob("**/SKILL.md")
    for (const rel of glob.scanSync({ cwd: root, onlyFiles: true })) {
      const file = path.join(root, rel)
      if (seen.has(file)) continue
      seen.add(file)
      const content = await Bun.file(file).text().catch(() => "")
      if (!content.trim()) continue
      const name = path.basename(path.dirname(file))
      found.push({ name, path: file, content })
    }
  }

  return found
}

export const loadSkillOptState = (directory: string) =>
  Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    const file = statePath(directory)
    if (!(yield* fs.existsSafe(file))) return defaultState
    const raw = yield* fs.readFileString(file).pipe(Effect.catch(() => Effect.succeed("{}")))
    try {
      return { ...defaultState, ...(JSON.parse(raw) as SkillOptState) }
    } catch {
      return defaultState
    }
  })

export const saveSkillOptState = (directory: string, state: SkillOptState) =>
  Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    yield* fs.writeWithDirs(statePath(directory), JSON.stringify(state, null, 2))
    return state
  })

function parseProposal(text: string) {
  const json = text.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim()
  const parsed = JSON.parse(json) as {
    edits?: SkillEdit[]
    newSkills?: { name: string; description: string; content: string }[]
    summary?: string
  }
  return parsed
}

function optimizeOneSkill(input: {
  skill: DiscoveredSkill
  trajectory: string
  settings: SkillOptSettings
  state: SkillOptState
  language: Parameters<typeof generateText>[0]["model"]
  rejectedSummary: string
}) {
  return Effect.gen(function* () {
    const maxEdits = input.settings.maxEditsPerCycle ?? defaultSkillOptSettings.maxEditsPerCycle!
    const maxDelta = input.settings.maxEditChars ?? defaultSkillOptSettings.maxEditChars!

    const result = yield* Effect.promise(() =>
      generateText({
        model: input.language,
        system: `You optimize agent SKILL.md documents using SkillOpt-style bounded edits.
Return ONLY JSON:
{
  "edits": [
    { "op": "add"|"delete"|"replace", "section": "Section title", "content": "markdown body for add/replace" }
  ],
  "summary": "one line rationale"
}
Rules:
- Propose at most ${maxEdits} edits.
- Prefer procedural, reusable guidance over instance-specific notes.
- Use add/replace for fixes; delete only obsolete sections.
- Do not repeat rejected edits listed below.`,
        prompt: `Skill: ${input.skill.name}
Path: ${input.skill.path}

Current SKILL.md:
${input.skill.content}

Recent execution trajectory:
${input.trajectory}

Rejected edits to avoid:
${input.rejectedSummary || "(none)"}`,
      }),
    ).pipe(Effect.catch(() => Effect.succeed(undefined)))

    if (!result?.text) return { accepted: false as const, reason: "no optimizer response" }

    let proposal: ReturnType<typeof parseProposal>
    try {
      proposal = parseProposal(result.text)
    } catch {
      return { accepted: false as const, reason: "invalid optimizer JSON" }
    }

    const edits = (proposal.edits ?? []).slice(0, maxEdits)
    if (edits.length === 0) return { accepted: false as const, reason: "no edits proposed" }

    const key = editsKey(input.skill.name, edits)
    if (input.state.rejected.some((item) => editsKey(item.skill, item.edits) === key)) {
      return { accepted: false as const, reason: "duplicate rejected edit" }
    }

    const applied = applySkillEdits(input.skill.content, edits, maxDelta)
    if (!applied.ok) return { accepted: false as const, reason: applied.reason, edits }

    const valid = validateSkillDocument(applied.content)
    if (!valid.ok) return { accepted: false as const, reason: valid.reason, edits }

    return {
      accepted: true as const,
      content: applied.content,
      edits,
      summary: proposal.summary ?? "skill optimized from session trajectory",
      delta: applied.delta,
    }
  })
}

export const optimizeSkillsFromSession = (sessionID: SessionID) =>
  Effect.gen(function* () {
    const session = yield* Session.Service
    const provider = yield* Provider.Service
    const ctx = yield* InstanceState.context
    const settings = yield* loadSkillOptSettings(ctx.directory)
    if (settings.enabled === false || settings.autoAfterSession === false) return { optimized: 0, rejected: 0 }

    const messages = yield* session.messages({ sessionID }).pipe(Effect.catch(() => Effect.succeed([])))
    const minMessages = settings.minSessionMessages ?? defaultSkillOptSettings.minSessionMessages!
    if (messages.length < minMessages) return { optimized: 0, rejected: 0 }

    const lastAssistant = messages.findLast((message) => message.info.role === "assistant")
    const model = (lastAssistant?.info as any)?.model
    if (!model) return { optimized: 0, rejected: 0 }

    const language = yield* provider.getLanguage(model).pipe(Effect.catch(() => Effect.succeed(undefined)))
    if (!language) return { optimized: 0, rejected: 0 }

    const skills = yield* Effect.promise(() => discoverProjectSkills(ctx.directory))
    const trajectory = sessionTrajectory(messages as Parameters<typeof sessionTrajectory>[0])
    let state = yield* loadSkillOptState(ctx.directory)
    const fs = yield* AppFileSystem.Service
    let optimized = 0
    let rejected = 0

    const rejectedSummary = state.rejected
      .slice(-8)
      .map((item) => `- ${item.skill}: ${item.reason} (${JSON.stringify(item.edits)})`)
      .join("\n")

    if (skills.length === 0) {
      const created = yield* Effect.promise(() =>
        generateText({
          model: language,
          system: `Create one reusable SKILL.md from session evidence. Return ONLY JSON:
{ "newSkills": [{ "name": "skill-name", "description": "...", "content": "---\\nname: ...\\ndescription: ...\\n---\\n\\n# Title\\n\\n..." }] }`,
          prompt: `Trajectory:\n${trajectory}`,
        }),
      ).pipe(Effect.catch(() => Effect.succeed(undefined)))

      if (!created?.text) return { optimized: 0, rejected: 0 }
      try {
        const proposal = parseProposal(created.text)
        for (const skill of proposal.newSkills ?? []) {
          const valid = validateSkillDocument(skill.content)
          if (!valid.ok) {
            rejected += 1
            state = {
              ...state,
              rejected: [...state.rejected, { skill: skill.name, edits: [], reason: valid.reason, at: Date.now() }].slice(-40),
            }
            continue
          }
          const dir = path.join(ctx.directory, "skills", skill.name)
          const file = path.join(dir, "SKILL.md")
          yield* fs.writeWithDirs(file, skill.content.trim())
          yield* fs.writeWithDirs(bestSkillPath(ctx.directory, skill.name), skill.content.trim())
          optimized += 1
          state = {
            ...state,
            accepted: [...state.accepted, { skill: skill.name, summary: "created from session", at: Date.now() }].slice(-40),
            skills: {
              ...state.skills,
              [skill.name]: { version: (state.skills[skill.name]?.version ?? 0) + 1, path: file, hash: hashContent(skill.content) },
            },
          }
        }
      } catch {
        return { optimized, rejected }
      }
      yield* saveSkillOptState(ctx.directory, state)
      return { optimized, rejected }
    }

    for (const skill of skills) {
      const outcome = yield* optimizeOneSkill({
        skill,
        trajectory,
        settings,
        state,
        language,
        rejectedSummary,
      })

      if (!outcome.accepted) {
        rejected += 1
        if ("edits" in outcome && outcome.edits) {
          state = {
            ...state,
            rejected: [
              ...state.rejected,
              { skill: skill.name, edits: outcome.edits, reason: outcome.reason, at: Date.now() },
            ].slice(-40),
          }
        }
        continue
      }

      yield* fs.writeWithDirs(skill.path, outcome.content.trim())
      yield* fs.writeWithDirs(bestSkillPath(ctx.directory, skill.name), outcome.content.trim())
      optimized += 1
      state = {
        ...state,
        accepted: [...state.accepted, { skill: skill.name, summary: outcome.summary, at: Date.now() }].slice(-40),
        skills: {
          ...state.skills,
          [skill.name]: {
            version: (state.skills[skill.name]?.version ?? 0) + 1,
            path: skill.path,
            hash: hashContent(outcome.content),
          },
        },
      }
    }

    yield* saveSkillOptState(ctx.directory, state)
    if (optimized > 0) yield* Effect.logInfo(`[SkillOpt] Accepted ${optimized} skill update(s) from session ${sessionID}`)
    return { optimized, rejected }
  })

export const runSkillOptMaintenance = () =>
  Effect.gen(function* () {
    const session = yield* Session.Service
    const ctx = yield* InstanceState.context
    const sessions = yield* session.list().pipe(Effect.catch(() => Effect.succeed([])))
    const latest = sessions
      .filter((item) => !item.parentID)
      .sort((a, b) => (b.time.updated ?? 0) - (a.time.updated ?? 0))[0]
    if (!latest) return { optimized: 0, rejected: 0, sessionID: undefined as string | undefined }
    const result = yield* optimizeSkillsFromSession(latest.id)
    return { ...result, sessionID: latest.id }
  })

export const getSkillOptOverview = (directory: string) =>
  Effect.gen(function* () {
    const settings = yield* loadSkillOptSettings(directory)
    const state = yield* loadSkillOptState(directory)
    const skills = yield* Effect.promise(() => discoverProjectSkills(directory))
    return {
      settings,
      state,
      skills: skills.map((skill) => ({
        name: skill.name,
        path: skill.path,
        version: state.skills[skill.name]?.version ?? 0,
        hash: state.skills[skill.name]?.hash,
      })),
      acceptedCount: state.accepted.length,
      rejectedCount: state.rejected.length,
    }
  })
