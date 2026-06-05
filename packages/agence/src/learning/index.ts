import { Effect, pipe } from "effect"
import { Database } from "@/storage/db"
import { eq, asc, and } from "drizzle-orm"
import { LearningTable, EmbeddingCacheTable } from "./learning.sql"
import { inferMemoryTags, mergeMemoryTags, tagMatchBoost } from "./memory-tags"
import crypto from "crypto"

export interface Learning {
  id: string
  projectId: string
  source: string
  concept: string
  description: string
  embedding?: number[]
  confidence: string
  relatedTo?: string[]
  skillPath?: string
  metadata?: Record<string, unknown>
  timeCreated: number
  score?: number
}

const EMBED_MODEL = process.env.AGENCE_EMBED_MODEL || "Xenova/all-MiniLM-L6-v2"

let embedPipeline: any = null

async function getPipeline() {
  if (!embedPipeline) {
    const { pipeline } = await import("@huggingface/transformers")
    embedPipeline = await pipeline("feature-extraction", EMBED_MODEL)
  }
  return embedPipeline
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

// Helper to cast projectId for Drizzle queries (branded type vs DB column type)
function pid(id: string) { return id as any }

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

export const GLOBAL_MEMORY_PROJECT_ID = "__global__"

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

function decayScore(learning: Learning, now = Date.now()) {
  const meta = learning.metadata ?? {}
  const importance =
    meta.importance === "critical" ? 4
    : meta.importance === "high" ? 3
    : meta.importance === "low" ? 1
    : learning.confidence === "high" ? 3
    : learning.confidence === "low" ? 1
    : 2
  const accessCount = typeof meta.accessCount === "number" ? meta.accessCount : 0
  const ageDays = (now - learning.timeCreated) / (1000 * 60 * 60 * 24)
  const ageFactor = Math.exp(-ageDays / (importance >= 3 ? 90 : importance === 2 ? 45 : 14))
  const accessBoost = 1 + Math.min(accessCount, 20) * 0.05
  return ageFactor * accessBoost * (importance / 4)
}

function rowToLearning(r: typeof LearningTable.$inferSelect): Learning {
  return {
    id: r.id, projectId: r.project_id, source: r.source,
    concept: r.concept, description: r.description,
    embedding: r.embedding ? JSON.parse(r.embedding) : undefined,
    confidence: r.confidence ?? "medium",
    relatedTo: r.related_to ? JSON.parse(r.related_to) : undefined,
    skillPath: r.skill_path ?? undefined,
    metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
    timeCreated: r.time_created,
  }
}

export const getEmbedding = (text: string) =>
  Effect.gen(function* () {
    const hash = crypto.createHash("sha256").update(text).digest("hex").slice(0, 16)

    const cached = yield* Effect.sync(() =>
      Database.use((db) => db.select().from(EmbeddingCacheTable).where(eq(EmbeddingCacheTable.hash, hash)).get()),
    )
    if (cached) return JSON.parse(cached.embedding) as number[]

    const emb = yield* Effect.promise(async () => {
      try {
        const pipe = await getPipeline()
        const result = await pipe(text, { pooling: "mean", normalize: true })
        return Array.from(result.data as Float32Array) as number[]
      } catch (e) {
        return [] as number[]
      }
    })

    if (emb.length === 0) return []

    yield* Effect.sync(() =>
      Database.transaction((db) => {
        db.insert(EmbeddingCacheTable).values({
          hash: hash,
          model: EMBED_MODEL,
          embedding: JSON.stringify(emb),
          dimensions: emb.length,
          time_created: Date.now(),
          time_updated: Date.now(),
        } as any).onConflictDoNothing().run()
      }),
    )

    return emb
  })

export const storeLearning = (input: {
  projectId: string; source: string; concept: string; description: string
  confidence?: string; relatedTo?: string[]; skillPath?: string; metadata?: Record<string, unknown>
}) =>
  Effect.gen(function* () {
    const id = uid()
    const combined = `${input.concept}: ${input.description}`
    const embedding = yield* getEmbedding(combined)
    const embeddingJson = embedding.length > 0 ? JSON.stringify(embedding) : null
    const layer = String(input.metadata?.layer ?? input.source)
    const explicitTags = Array.isArray(input.metadata?.tags)
      ? (input.metadata.tags as string[])
      : undefined
    const metadata = {
      accessCount: 0,
      ...input.metadata,
      layer,
      tags: mergeMemoryTags(
        explicitTags,
        inferMemoryTags({
          layer,
          concept: input.concept,
          description: input.description,
          reason: typeof input.metadata?.reason === "string" ? input.metadata.reason : undefined,
        }),
      ),
    }

    yield* Effect.sync(() =>
      Database.transaction((db) => {
        db.insert(LearningTable).values({
          id,
          project_id: pid(input.projectId),
          source: input.source, concept: input.concept, description: input.description,
          embedding: embeddingJson, confidence: input.confidence ?? "medium",
          related_to: input.relatedTo ? JSON.stringify(input.relatedTo) : null,
          skill_path: input.skillPath ?? null,
          metadata: JSON.stringify(metadata),
          time_created: Date.now(), time_updated: Date.now(),
        } as any).run()
      }),
    )

    const { linkCrossLayer } = yield* Effect.promise(() => import("./memory-intelligence"))
    yield* pipe(
      linkCrossLayer({
        projectId: input.projectId,
        memoryId: id,
        layer: String(metadata.layer),
        description: input.description,
      }),
      Effect.catch(() => Effect.void)
    )

    return id
  })

export const searchLearnings = (params: {
  projectId: string
  query: string
  limit?: number
  includeGlobal?: boolean
}) =>
  Effect.gen(function* () {
    const limit = params.limit ?? 10
    const queryEmbedding = yield* getEmbedding(params.query)
    const projectIds = params.includeGlobal === false
      ? [params.projectId]
      : params.projectId === GLOBAL_MEMORY_PROJECT_ID
        ? [GLOBAL_MEMORY_PROJECT_ID]
        : [params.projectId, GLOBAL_MEMORY_PROJECT_ID]

    const rows = yield* Effect.sync(() =>
      Database.use((db) =>
        db
          .select()
          .from(LearningTable)
          .all()
          .filter((r) => projectIds.includes(r.project_id as string)),
      ),
    )

    const bumpAccess = (ids: string[]) =>
      Effect.sync(() =>
        Database.transaction((db) => {
          for (const id of ids) {
            const row = db.select().from(LearningTable).where(eq(LearningTable.id, id)).get()
            if (!row) continue
            const meta = parseMetadata(row.metadata)
            meta.accessCount = (typeof meta.accessCount === "number" ? meta.accessCount : 0) + 1
            meta.lastAccessed = Date.now()
            db.update(LearningTable)
              .set({ metadata: JSON.stringify(meta), time_updated: Date.now() } as any)
              .where(eq(LearningTable.id, id))
              .run()
          }
        }),
      )

    if (queryEmbedding.length === 0) {
      const matched = rows
        .filter(
          (r) =>
            r.concept.toLowerCase().includes(params.query.toLowerCase()) ||
            r.description.toLowerCase().includes(params.query.toLowerCase()),
        )
        .map(rowToLearning)
        .map((l) => {
          const tags = Array.isArray(l.metadata?.tags) ? (l.metadata.tags as string[]) : undefined
          l.score = decayScore(l) * tagMatchBoost(params.query, tags)
          return l
        })
        .filter((l) => (l.score ?? 0) > 0.05)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, limit)
      yield* bumpAccess(matched.map((m) => m.id))
      return matched
    }

    const ranked = rows
      .map((r) => {
        const l = rowToLearning(r)
        const embed = r.embedding ? (JSON.parse(r.embedding) as number[]) : null
        const similarity = embed ? cosineSimilarity(queryEmbedding, embed) : 0
        const tags = Array.isArray(l.metadata?.tags) ? (l.metadata.tags as string[]) : undefined
        l.score = similarity * decayScore(l) * tagMatchBoost(params.query, tags)
        return l
      })
      .filter((l) => (l.score ?? 0) > 0.03)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, limit)

    yield* bumpAccess(ranked.map((r) => r.id))
    return ranked
  })

export const listLearnings = (params: {
  projectId: string
  layer?: string
  includeGlobal?: boolean
  limit?: number
}) =>
  Effect.gen(function* () {
    const limit = params.limit ?? 200
    const projectIds =
      params.includeGlobal === false
        ? [params.projectId]
        : params.projectId === GLOBAL_MEMORY_PROJECT_ID
          ? [GLOBAL_MEMORY_PROJECT_ID]
          : [params.projectId, GLOBAL_MEMORY_PROJECT_ID]
    const rows = yield* Effect.sync(() =>
      Database.use((db) =>
        db
          .select()
          .from(LearningTable)
          .all()
          .filter((r) => projectIds.includes(r.project_id as string))
          .filter((r) => (params.layer ? r.source === params.layer : true)),
      ),
    )
    return rows
      .map(rowToLearning)
      .map((l) => ({ ...l, decay: decayScore(l) }))
      .sort((a, b) => b.decay - a.decay)
      .slice(0, limit)
  })

export const deleteLearning = (id: string) =>
  Effect.sync(() =>
    Database.use((db) => db.delete(LearningTable).where(eq(LearningTable.id, id)).run()),
  )

export const deleteLearningForProject = (id: string, projectId: string) =>
  Effect.sync(() =>
    Database.use((db) =>
      db
        .delete(LearningTable)
        .where(and(eq(LearningTable.id, id), eq(LearningTable.project_id, pid(projectId))))
        .run(),
    ),
  )

export const recentLearnings = (params: { projectId: string; source?: string; limit?: number }) =>
  Effect.gen(function* () {
    const limit = params.limit ?? 10
    const projectIds =
      params.projectId === GLOBAL_MEMORY_PROJECT_ID
        ? [GLOBAL_MEMORY_PROJECT_ID]
        : [params.projectId, GLOBAL_MEMORY_PROJECT_ID]
    const rows = yield* Effect.sync(() =>
      Database.use((db) =>
        db
          .select()
          .from(LearningTable)
          .all()
          .filter((r) => projectIds.includes(r.project_id as string))
          .filter((r) => (params.source ? r.source === params.source : true)),
      ),
    )
    return rows
      .map(rowToLearning)
      .filter((l) => decayScore(l) > 0.05)
      .sort((a, b) => decayScore(b) - decayScore(a))
      .slice(0, limit)
  })
