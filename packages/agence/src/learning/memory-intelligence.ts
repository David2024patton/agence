import { Effect } from "effect"
import { eq } from "drizzle-orm"
import { Database } from "@/storage/db"
import { LearningTable } from "./learning.sql"
import { ProjectTable } from "../project/project.sql"
import { cosineSimilarity, getEmbedding, GLOBAL_MEMORY_PROJECT_ID, type Learning } from "./index"
import { inferMemoryTags } from "./memory-tags"
import type { SessionID } from "@/session/schema"
import path from "path"
import crypto from "crypto"

const LAYERS = ["activity", "context", "experience", "identity", "preference"] as const
export type MemoryLayer = (typeof LAYERS)[number]

const IMPORTANCE_RANK = { low: 1, medium: 2, high: 3, critical: 4 } as const

type AutoMemory = {
  layer: MemoryLayer
  content: string
  importance: keyof typeof IMPORTANCE_RANK
  reason: string
  tags: string[]
}

type MessageLike = {
  info: { role: string }
  parts: { type: string; text?: string; value?: string; tool?: string; state?: string; error?: string }[]
}

function pid(id: string) {
  return id as any
}

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

function importanceFromMeta(meta: Record<string, unknown>, confidence: string | null): keyof typeof IMPORTANCE_RANK {
  const raw = meta.importance
  if (raw === "low" || raw === "medium" || raw === "high" || raw === "critical") return raw
  if (confidence === "high") return "high"
  if (confidence === "low") return "low"
  return "medium"
}

export function computeDecayScore(learning: Learning, now = Date.now()): number {
  const meta = learning.metadata ?? {}
  const importance = importanceFromMeta(meta, learning.confidence)
  const rank = IMPORTANCE_RANK[importance]
  const accessCount = typeof meta.accessCount === "number" ? meta.accessCount : 0
  const ageDays = (now - learning.timeCreated) / (1000 * 60 * 60 * 24)
  const ageFactor = Math.exp(-ageDays / (rank >= 3 ? 90 : rank === 2 ? 45 : 14))
  const accessBoost = 1 + Math.min(accessCount, 20) * 0.05
  const expiresAt = typeof meta.expiresAt === "number" ? meta.expiresAt : undefined
  if (expiresAt && expiresAt < now) return 0
  return ageFactor * accessBoost * (rank / 4)
}

export function detectAutoMemories(messages: MessageLike[]): AutoMemory[] {
  const out: AutoMemory[] = []
  const seen = new Set<string>()

  const push = (item: Omit<AutoMemory, "tags">) => {
    const key = `${item.layer}:${item.content.slice(0, 120).toLowerCase()}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({
      ...item,
      tags: inferMemoryTags({ layer: item.layer, description: item.content, reason: item.reason }),
    })
  }

  const textOf = (m: MessageLike) =>
    m.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? p.value ?? "")
      .join("\n")
      .trim()

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const text = textOf(msg)

    if (msg.info.role === "user") {
      if (!text) continue
      if (/\b(always|never|prefer|don't want|do not want|i like|i hate|from now on)\b/i.test(text)) {
        push({
          layer: "preference",
          content: text.slice(0, 500),
          importance: "high",
          reason: "user_preference",
        })
      }
      if (/\b(no|wrong|incorrect|don't|do not|stop|instead|actually|not what i)\b/i.test(text) && text.length < 400) {
        push({
          layer: "experience",
          content: `User correction: ${text.slice(0, 400)}`,
          importance: "high",
          reason: "user_correction",
        })
      }
    }

    if (msg.info.role === "assistant") {
      for (const part of msg.parts) {
        const isTool = part.type === "tool" || part.type === "tool-invocation" || Boolean(part.tool)
        if (!isTool) continue
        const err = part.error ?? (part.state === "error" ? textOf(msg) : "")
        if (!err || err.length < 8) continue
        push({
          layer: "activity",
          content: `Tool ${part.tool ?? "unknown"} failed: ${err.slice(0, 300)}`,
          importance: "medium",
          reason: "tool_failure",
        })
        push({
          layer: "experience",
          content: `Avoid repeating: ${part.tool ?? "tool"} error — ${err.slice(0, 250)}`,
          importance: "high",
          reason: "tool_failure_lesson",
        })
      }
    }
  }

  return out.slice(0, 8)
}

function chunkMarkdown(input: string, maxChars = 1800): string[] {
  const normalized = input.replace(/\r\n/g, "\n").trim()
  if (!normalized) return []

  const blocks = normalized
    .split(/\n(?=##\s+)/g)
    .map((b) => b.trim())
    .filter(Boolean)

  const out: string[] = []
  for (const block of (blocks.length > 0 ? blocks : [normalized])) {
    if (block.length <= maxChars) {
      out.push(block)
      continue
    }
    for (let i = 0; i < block.length; i += maxChars) out.push(block.slice(i, i + maxChars).trim())
  }
  return out.filter(Boolean)
}

export const ingestMarkdownDocToMemory = (input: {
  projectId: string
  directory: string
  docPath: string
  layer?: MemoryLayer
  tags?: string[]
}) =>
  Effect.gen(function* () {
    const fullPath = path.isAbsolute(input.docPath) ? input.docPath : path.join(input.directory, input.docPath)
    const raw = yield* Effect.promise(async () => {
      try {
        return await Bun.file(fullPath).text()
      } catch {
        return ""
      }
    })
    const text = raw.trim()
    if (!text) return { chunks: 0, docPath: fullPath }

    const chunks = chunkMarkdown(text)
    if (chunks.length === 0) return { chunks: 0, docPath: fullPath }

    const docRel = path.relative(input.directory, fullPath).replace(/\\/g, "/")
    const docId = `doc:${docRel}`
    const docHash = crypto.createHash("sha256").update(text).digest("hex").slice(0, 24)

    const existing = yield* Effect.sync(() =>
      Database.use((db) =>
        db
          .select({ id: LearningTable.id, concept: LearningTable.concept })
          .from(LearningTable)
          .all()
          .filter((r) => (r.concept ?? "").startsWith(`${docId}#`))
          .map((r) => r.id),
      ),
    )

    if (existing.length > 0) {
      yield* Effect.sync(() =>
        Database.transaction((db) => {
          for (const id of existing) db.delete(LearningTable).where(eq(LearningTable.id, id)).run()
        }),
      )
    }

    const { storeLearning } = yield* Effect.promise(() => import("./index"))
    const layer = input.layer ?? "experience"
    const tags = Array.isArray(input.tags) ? input.tags : ["knowledge", "debug", "fix"]

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      yield* storeLearning({
        projectId: input.projectId,
        source: layer,
        concept: `${docId}#${i + 1}`,
        description: chunk,
        confidence: "high",
        metadata: {
          layer,
          importance: "high",
          autoCapture: false,
          tags,
          docPath: docRel,
          docHash,
          chunkIndex: i,
          chunkCount: chunks.length,
        },
      }).pipe(Effect.catch(() => Effect.void))
    }

    return { chunks: chunks.length, docPath: fullPath }
  })

export const ensureGlobalMemoryProject = () =>
  Effect.sync(() =>
    Database.use((db) => {
      const existing = db.select().from(ProjectTable).where(eq(ProjectTable.id, pid(GLOBAL_MEMORY_PROJECT_ID))).get()
      if (existing) return
      const now = Date.now()
      db.insert(ProjectTable)
        .values({
          id: pid(GLOBAL_MEMORY_PROJECT_ID),
          worktree: GLOBAL_MEMORY_PROJECT_ID,
          name: "Global memories",
          sandboxes: [],
          time_created: now,
          time_updated: now,
        } as any)
        .onConflictDoNothing()
        .run()
    }),
  )

const IMPORTANCE_ORDER = { low: 1, medium: 2, high: 3, critical: 4 } as const

function passesImportance(item: AutoMemory, min: keyof typeof IMPORTANCE_ORDER) {
  return IMPORTANCE_ORDER[item.importance] >= IMPORTANCE_ORDER[min]
}

export const autoCaptureFromSession = (sessionID: SessionID) =>
  Effect.gen(function* () {
    const { Session } = yield* Effect.promise(() => import("@/session/session"))
    const { InstanceState } = yield* Effect.promise(() => import("@/effect/instance-state"))
    const { loadMemorySettings } = yield* Effect.promise(() => import("./memory-settings"))
    const session = yield* Session.Service
    const ctx = yield* InstanceState.context
    const settings = yield* loadMemorySettings(ctx.directory)
    if (settings.autoCaptureEnabled === false) return

    const messages = yield* session.messages({ sessionID }).pipe(Effect.catch(() => Effect.succeed([] as MessageLike[])))
    if (messages.length < 2) return

    yield* ensureGlobalMemoryProject()
    const detected = detectAutoMemories(messages as MessageLike[]).filter((item) => {
      if (item.layer === "preference" && settings.capturePreferences === false) return false
      if (item.layer === "experience" && settings.captureCorrections === false) return false
      if (item.layer === "activity" && settings.captureToolFailures === false) return false
      return passesImportance(item, settings.minAutoImportance ?? "low")
    })
    if (detected.length === 0) return

    const { storeLearning } = yield* Effect.promise(() => import("./index"))
    for (const item of detected) {
      const global =
        item.layer === "preference" || item.layer === "identity" || item.importance === "critical"
      const projectId = global ? GLOBAL_MEMORY_PROJECT_ID : ctx.project.id
      yield* storeLearning({
        projectId,
        source: item.layer,
        concept: `auto:${item.reason}`,
        description: item.content,
        confidence: item.importance === "critical" || item.importance === "high" ? "high" : "medium",
        metadata: {
          layer: item.layer,
          importance: item.importance,
          autoCapture: true,
          reason: item.reason,
          tags: item.tags,
          sessionID,
          accessCount: 0,
        },
      }).pipe(Effect.catch(() => Effect.void))
    }

    if (
      settings.autoConsolidate !== false ||
      settings.autoPruneStale !== false ||
      settings.autoPruneRedundant !== false
    ) {
      if (settings.autoConsolidate !== false) yield* consolidateProjectLearnings(ctx.project.id)
      if (settings.autoPruneRedundant !== false) yield* pruneRedundantLearnings(ctx.project.id)
      if (settings.autoPruneStale !== false) yield* pruneStaleLearnings(ctx.project.id)
    }
    yield* Effect.logInfo(`[Agence Memory] Auto-captured ${detected.length} memories from session ${sessionID}`)
  })

export const linkCrossLayer = (input: {
  projectId: string
  memoryId: string
  layer: string
  description: string
}) =>
  Effect.gen(function* () {
    const related = yield* searchRelatedAcrossLayers(input.projectId, input.description, input.layer)
    if (related.length === 0) return

    yield* Effect.sync(() =>
      Database.transaction((db) => {
        const row = db.select().from(LearningTable).where(eq(LearningTable.id, input.memoryId)).get()
        if (!row) return
        const meta = parseMetadata(row.metadata)
        const links = new Set<string>([
          ...(Array.isArray(meta.crossLayerLinks) ? (meta.crossLayerLinks as string[]) : []),
          ...related.map((r) => r.id),
        ])
        meta.crossLayerLinks = [...links]
        db.update(LearningTable)
          .set({ metadata: JSON.stringify(meta), time_updated: Date.now() } as any)
          .where(eq(LearningTable.id, input.memoryId))
          .run()
      }),
    )
  })

function searchRelatedAcrossLayers(projectId: string, description: string, excludeLayer: string) {
  return Effect.gen(function* () {
    const queryEmbedding = yield* getEmbedding(description)
    const projectIds = projectId === GLOBAL_MEMORY_PROJECT_ID ? [projectId] : [projectId, GLOBAL_MEMORY_PROJECT_ID]
    const rows = yield* Effect.sync(() =>
      Database.use((db) =>
        db
          .select()
          .from(LearningTable)
          .all()
          .filter((r) => projectIds.includes(r.project_id as string)),
      ),
    )

    const scored = rows
      .map((r) => {
        const layer = r.source
        if (layer === excludeLayer) return undefined
        const embed = r.embedding ? (JSON.parse(r.embedding) as number[]) : null
        if (!embed || queryEmbedding.length === 0) return undefined
        return { id: r.id, layer, score: cosineSimilarity(queryEmbedding, embed) }
      })
      .filter((x): x is { id: string; layer: string; score: number } => !!x && x.score > 0.72)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)

    return scored
  })
}

export const consolidateProjectLearnings = (projectId: string) =>
  Effect.gen(function* () {
    const rows = yield* Effect.sync(() =>
      Database.use((db) =>
        db.select().from(LearningTable).where(eq(LearningTable.project_id, pid(projectId))).all(),
      ),
    )
    if (rows.length < 2) return 0

    const items = rows.map((r) => ({
      row: r,
      embed: r.embedding ? (JSON.parse(r.embedding) as number[]) : ([] as number[]),
      learning: {
        id: r.id,
        projectId: r.project_id,
        source: r.source,
        concept: r.concept,
        description: r.description,
        confidence: r.confidence ?? "medium",
        metadata: parseMetadata(r.metadata),
        timeCreated: r.time_created,
      } satisfies Learning,
    }))

    let merged = 0
    const removed = new Set<string>()

    for (let i = 0; i < items.length; i++) {
      if (removed.has(items[i].row.id)) continue
      for (let j = i + 1; j < items.length; j++) {
        if (removed.has(items[j].row.id)) continue
        const a = items[i]
        const b = items[j]
        const similarConcept = a.row.concept.toLowerCase() === b.row.concept.toLowerCase()
        const similarEmbed =
          a.embed.length > 0 && b.embed.length > 0 && cosineSimilarity(a.embed, b.embed) > 0.9
        if (!similarConcept && !similarEmbed) continue

        const keep = computeDecayScore(a.learning) >= computeDecayScore(b.learning) ? a : b
        const drop = keep === a ? b : a
        const summary = `${keep.row.description}\n\n(consolidated) ${drop.row.description}`.slice(0, 2000)

        yield* Effect.sync(() =>
          Database.transaction((db) => {
            const meta = parseMetadata(keep.row.metadata)
            meta.consolidatedFrom = [...(Array.isArray(meta.consolidatedFrom) ? (meta.consolidatedFrom as string[]) : []), drop.row.id]
            db.update(LearningTable)
              .set({
                description: summary,
                metadata: JSON.stringify(meta),
                time_updated: Date.now(),
              } as any)
              .where(eq(LearningTable.id, keep.row.id))
              .run()
            db.delete(LearningTable).where(eq(LearningTable.id, drop.row.id)).run()
          }),
        )
        removed.add(drop.row.id)
        merged++
      }
    }

    return merged
  })

export const pruneRedundantLearnings = (projectId: string) =>
  Effect.gen(function* () {
    const rows = yield* Effect.sync(() =>
      Database.use((db) =>
        db.select().from(LearningTable).where(eq(LearningTable.project_id, pid(projectId))).all(),
      ),
    )
    if (rows.length < 2) return 0

    const items = rows.map((r) => ({
      row: r,
      embed: r.embedding ? (JSON.parse(r.embedding) as number[]) : ([] as number[]),
      learning: {
        id: r.id,
        projectId: r.project_id,
        source: r.source,
        concept: r.concept,
        description: r.description,
        confidence: r.confidence ?? "medium",
        metadata: parseMetadata(r.metadata),
        timeCreated: r.time_created,
      } satisfies Learning,
    }))

    const removed = new Set<string>()
    let pruned = 0

    for (let i = 0; i < items.length; i++) {
      if (removed.has(items[i].row.id)) continue
      for (let j = i + 1; j < items.length; j++) {
        if (removed.has(items[j].row.id)) continue
        const a = items[i]
        const b = items[j]
        if (a.embed.length === 0 || b.embed.length === 0) continue
        const sim = cosineSimilarity(a.embed, b.embed)
        if (sim < 0.86 || sim >= 0.9) continue

        const aMeta = a.learning.metadata ?? {}
        const bMeta = b.learning.metadata ?? {}
        const aCritical = aMeta.importance === "critical" || a.learning.confidence === "high"
        const bCritical = bMeta.importance === "critical" || b.learning.confidence === "high"
        if (aCritical && bCritical) continue

        const keep = computeDecayScore(a.learning) >= computeDecayScore(b.learning) ? a : b
        const drop = keep === a ? b : a
        yield* Effect.sync(() =>
          Database.use((db) => db.delete(LearningTable).where(eq(LearningTable.id, drop.row.id)).run()),
        )
        removed.add(drop.row.id)
        pruned++
      }
    }

    return pruned
  })

export const pruneStaleLearnings = (projectId: string) =>
  Effect.gen(function* () {
    const rows = yield* Effect.sync(() =>
      Database.use((db) =>
        db.select().from(LearningTable).where(eq(LearningTable.project_id, pid(projectId))).all(),
      ),
    )
    const now = Date.now()
    let pruned = 0
    for (const r of rows) {
      const learning = {
        id: r.id,
        projectId: r.project_id,
        source: r.source,
        concept: r.concept,
        description: r.description,
        confidence: r.confidence ?? "medium",
        metadata: parseMetadata(r.metadata),
        timeCreated: r.time_created,
      } satisfies Learning
      const meta = learning.metadata ?? {}
      if (meta.autoCapture !== true) continue
      if (computeDecayScore(learning, now) > 0.08) continue
      yield* Effect.sync(() =>
        Database.use((db) => db.delete(LearningTable).where(eq(LearningTable.id, r.id)).run()),
      )
      pruned++
    }
    return pruned
  })

export const refineConceptRelationships = (input: {
  projectId: string
  memoryId: string
  concept: string
  description: string
  relatedTo?: readonly string[]
}) =>
  Effect.gen(function* () {
    const related = yield* searchRelatedAcrossLayers(input.projectId, `${input.concept} ${input.description}`, "model_learn")
    const conceptLinks = [...(input.relatedTo ?? []), ...related.map((r) => r.id)]
    if (conceptLinks.length === 0) return

    yield* Effect.sync(() =>
      Database.transaction((db) => {
        const row = db.select().from(LearningTable).where(eq(LearningTable.id, input.memoryId)).get()
        if (!row) return
        const meta = parseMetadata(row.metadata)
        const links = new Set<string>([
          ...(Array.isArray(meta.crossLayerLinks) ? (meta.crossLayerLinks as string[]) : []),
          ...related.map((r) => r.id),
        ])
        meta.crossLayerLinks = [...links]
        meta.conceptMap = {
          concept: input.concept,
          relatedConcepts: [...new Set(conceptLinks)].slice(0, 12),
          refinedAt: Date.now(),
        }
        db.update(LearningTable)
          .set({
            related_to: JSON.stringify([...new Set(conceptLinks)].slice(0, 12)),
            metadata: JSON.stringify(meta),
            time_updated: Date.now(),
          } as any)
          .where(eq(LearningTable.id, input.memoryId))
          .run()
      }),
    )

    yield* linkCrossLayer({
      projectId: input.projectId,
      memoryId: input.memoryId,
      layer: "model_learn",
      description: input.description,
    }).pipe(Effect.catch(() => Effect.void))
  })

export const exportProjectMemories = (projectId: string) =>
  Effect.gen(function* () {
    const { listLearnings } = yield* Effect.promise(() => import("./index"))
    const { InstanceState } = yield* Effect.promise(() => import("@/effect/instance-state"))
    const { AppFileSystem } = yield* Effect.promise(() => import("@agence-ai/core/filesystem"))
    const ctx = yield* InstanceState.context
    const fs = yield* AppFileSystem.Service
    const items = yield* listLearnings({ projectId, includeGlobal: true, limit: 500 })
    const payload = {
      exportedAt: new Date().toISOString(),
      projectId,
      count: items.length,
      memories: items.map((m) => ({
        id: m.id,
        projectId: m.projectId,
        source: m.source,
        layer: m.metadata?.layer ?? m.source,
        tags: m.metadata?.tags ?? [],
        concept: m.concept,
        description: m.description,
        metadata: m.metadata,
        timeCreated: m.timeCreated,
      })),
    }
    const file = `${ctx.directory}/.agence/memory-export.json`
    yield* fs.writeWithDirs(file, JSON.stringify(payload, null, 2))
    return { path: file, count: items.length }
  })

export const runMemoryMaintenance = (projectId: string) =>
  Effect.gen(function* () {
    const { InstanceState } = yield* Effect.promise(() => import("@/effect/instance-state"))
    const { loadMemorySettings } = yield* Effect.promise(() => import("./memory-settings"))
    const ctx = yield* InstanceState.context
    const settings = yield* loadMemorySettings(ctx.directory)
    const merged =
      settings.autoConsolidate === false ? 0 : yield* consolidateProjectLearnings(projectId)
    const redundant =
      settings.autoPruneRedundant === false ? 0 : yield* pruneRedundantLearnings(projectId)
    const pruned = settings.autoPruneStale === false ? 0 : yield* pruneStaleLearnings(projectId)
    if (settings.exportOnMaintenance) {
      yield* exportProjectMemories(projectId).pipe(Effect.catch(() => Effect.void))
    }
    if (merged > 0 || pruned > 0 || redundant > 0) {
      yield* Effect.logInfo(
        `[Agence Memory] Maintenance for ${projectId}: merged=${merged}, redundant=${redundant}, pruned=${pruned}`,
      )
    }
  })

export const recallMemoriesForContext = (input: { projectId: string; query: string; limit?: number }) =>
  Effect.gen(function* () {
    const { searchLearnings } = yield* Effect.promise(() => import("./index"))
    const { InstanceState } = yield* Effect.promise(() => import("@/effect/instance-state"))
    const { loadMemorySettings } = yield* Effect.promise(() => import("./memory-settings"))
    const ctx = yield* InstanceState.context
    const settings = yield* loadMemorySettings(ctx.directory)
    const limit = input.limit ?? 8
    const results = yield* searchLearnings({
      projectId: input.projectId,
      query: input.query,
      limit: limit * 2,
      includeGlobal: settings.globalRecall !== false,
    })

    const ranked = results
      .map((r) => ({ ...r, decay: computeDecayScore(r) }))
      .filter((r) => r.decay > 0.05)
      .sort((a, b) => (b.score ?? 0) * b.decay - (a.score ?? 0) * a.decay)
      .slice(0, limit)

    const lines: string[] = []
    for (const r of ranked) {
      const meta = r.metadata ?? {}
      const layer = typeof meta.layer === "string" ? meta.layer : r.source
      const tags = Array.isArray(meta.tags) ? (meta.tags as string[]).slice(0, 4) : []
      const links = Array.isArray(meta.crossLayerLinks) ? (meta.crossLayerLinks as string[]) : []
      const tagNote = tags.length > 0 ? ` #${tags.join(" #")}` : ""
      const linkNote = links.length > 0 ? ` | linked: ${links.length} related` : ""
      lines.push(`  - [${layer.toUpperCase()}]${tagNote} ${r.concept}: ${r.description.slice(0, 220)}${linkNote}`)
    }

    if (lines.length === 0) return undefined
    return [
      `<past_learnings>`,
      `Relevant memories (ranked by importance, recency, and semantic match):`,
      ...lines,
      `</past_learnings>`,
    ].join("\n")
  })
