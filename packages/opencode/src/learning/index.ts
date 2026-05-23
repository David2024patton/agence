import { Effect } from "effect"
import { Database } from "@/storage/db"
import { eq, asc } from "drizzle-orm"
import { LearningTable, EmbeddingCacheTable } from "./learning.sql"
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

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
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

    yield* Effect.sync(() =>
      Database.transaction((db) => {
        db.insert(LearningTable).values({
          id,
          project_id: input.projectId,
          source: input.source, concept: input.concept, description: input.description,
          embedding: embeddingJson, confidence: input.confidence ?? "medium",
          related_to: input.relatedTo ? JSON.stringify(input.relatedTo) : null,
          skill_path: input.skillPath ?? null,
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
          time_created: Date.now(), time_updated: Date.now(),
        } as any).run()
      }),
    )

    return id
  })

export const searchLearnings = (params: { projectId: string; query: string; limit?: number }) =>
  Effect.gen(function* () {
    const limit = params.limit ?? 10
    const queryEmbedding = yield* getEmbedding(params.query)

    const rows = yield* Effect.sync(() =>
      Database.use((db) =>
        db.select().from(LearningTable)
          .where(eq(LearningTable.project_id, params.projectId as any))
          .orderBy(asc(LearningTable.time_created)).all(),
      ),
    )

    if (queryEmbedding.length === 0) {
      return rows.filter((r) =>
        r.concept.toLowerCase().includes(params.query.toLowerCase()) ||
        r.description.toLowerCase().includes(params.query.toLowerCase()),
      ).slice(0, limit).map(rowToLearning)
    }

    return rows.map((r) => {
      const l = rowToLearning(r)
      const embed = r.embedding ? JSON.parse(r.embedding) as number[] : null
      l.score = embed ? cosineSimilarity(queryEmbedding, embed) : 0
      return l
    }).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, limit)
  })

export const recentLearnings = (params: { projectId: string; source?: string; limit?: number }) =>
  Effect.gen(function* () {
    const limit = params.limit ?? 10
    const rows = yield* Effect.sync(() =>
      Database.use((db) => {
        let q = db.select().from(LearningTable).where(eq(LearningTable.project_id, params.projectId as any))
        if (params.source) {
          q = db.select().from(LearningTable)
            .where(eq(LearningTable.project_id, params.projectId as any))
        }
        return q.orderBy(asc(LearningTable.time_created)).limit(limit).all()
      }),
    )
    return rows.map(rowToLearning)
  })
