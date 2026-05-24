// Conversation Archive: auto-saves conversations when compaction triggers.
// Stores title, structured summary, subject, tags, and embedding for semantic search.
// Tools: archive_conversation, search_archives, recall_archive
import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { InstanceState } from "@/effect/instance-state"
import { Schema, Effect, Context, Layer } from "effect"
import { ConversationArchiveTable } from "./archive.sql"
import type { SessionID } from "@/session/schema"
import { ulid } from "ulid"
import { getEmbedding } from "./index"

export class ArchiveService extends Context.Service<ArchiveService, {
  archive: (input: {
    sessionID: string
    title: string
    summary: string
    subject: string
    tags?: string[]
    tokenCount: number
    messageCount: number
    compactedSummary?: string
  }) => Effect.Effect<string>
  search: (input: { projectID: string; query: string; limit?: number }) => Effect.Effect<Array<{
    id: string
    title: string
    subject: string
    summary: string
    tokenCount: number
    created: number
    score: number
  }>>
  getIndex: (input: { projectID?: string; limit?: number }) => Effect.Effect<Array<{
    id: string
    sessionID: string
    title: string
    subject: string
    tags: string[]
    tokenCount: number
    messageCount: number
    created: number
  }>>
  recall: (input: { id: string }) => Effect.Effect<any>
}>()("@agence/ConversationArchive") {}

export const layer = Layer.effect(
  ArchiveService,
  Effect.gen(function* () {
    const archive = (input: Parameters<ArchiveService["archive"]>[0]) =>
      Effect.gen(function* () {
        const id = ulid()
        const tags = input.tags ? JSON.stringify(input.tags) : null

        // Generate embedding for semantic search
        let embedding: string | null = null
        try {
          const embedText = `${input.subject}: ${input.summary.substring(0, 500)}`
          const emb = yield* Effect.promise(() => getEmbedding(embedText))
          if (emb) embedding = JSON.stringify(emb)
        } catch {
          // Embedding is optional
        }

        yield* Effect.sync(() => {
          const stmt = Database.use((db) =>
            db.prepare(`INSERT INTO conversation_archive (id, project_id, session_id, title, summary, subject, tags, embedding, token_count, message_count, compacted_summary, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          )
          stmt.run(
            id, "global", input.sessionID, input.title, input.summary,
            input.subject, tags, embedding, input.tokenCount,
            input.messageCount, input.compactedSummary ?? null,
            Date.now(), Date.now(),
          )
        })

        return id
      })

    const search = (input: Parameters<ArchiveService["search"]>[0]) =>
      Effect.gen(function* () {
        let queryEmbedding: number[] | null = null
        try {
          queryEmbedding = yield* Effect.promise(() => getEmbedding(input.query))
        } catch {
          queryEmbedding = null
        }

        const rows = yield* Effect.sync(() => {
          const stmt = Database.use((db) =>
            db.prepare(`SELECT * FROM conversation_archive WHERE project_id = ? ORDER BY time_created DESC`)
          )
          return stmt.all(input.projectID ?? "global")
        }) as Array<Record<string, any>>

        const results = rows.map((row) => {
          let score = 0
          if (queryEmbedding && row.embedding) {
            try {
              const emb = JSON.parse(row.embedding) as number[]
              score = cosineSimilarity(queryEmbedding, emb)
            } catch {}
          } else {
            // Text fallback
            const q = input.query.toLowerCase()
            if (row.subject?.toLowerCase().includes(q)) score = 0.5
            if (row.title?.toLowerCase().includes(q)) score = Math.max(score, 0.4)
            if (row.summary?.toLowerCase().includes(q)) score = Math.max(score, 0.3)
          }

          return {
            id: row.id,
            title: row.title,
            subject: row.subject,
            summary: row.summary?.substring(0, 200) ?? "",
            tokenCount: row.token_count,
            created: row.time_created,
            score,
          }
        })

        return results
          .filter((r) => r.score > 0.05)
          .sort((a, b) => b.score - a.score)
          .slice(0, input.limit ?? 10)
      })

    const getIndex = (input: Parameters<ArchiveService["getIndex"]>[0]) =>
      Effect.gen(function* () {
        const rows = yield* Effect.sync(() => {
          const stmt = Database.use((db) =>
            db.prepare(`SELECT * FROM conversation_archive WHERE project_id = ? ORDER BY time_created DESC LIMIT ?`)
          )
          return stmt.all(input.projectID ?? "global", input.limit ?? 50)
        }) as Array<Record<string, any>>

        return rows.map((row) => ({
          id: row.id,
          sessionID: row.session_id,
          title: row.title,
          subject: row.subject,
          tags: row.tags ? JSON.parse(row.tags) : [],
          tokenCount: row.token_count,
          messageCount: row.message_count,
          created: row.time_created,
        }))
      })

    const recall = (input: Parameters<ArchiveService["recall"]>[0]) =>
      Effect.gen(function* () {
        const row = yield* Effect.sync(() => {
          const stmt = Database.use((db) =>
            db.prepare(`SELECT * FROM conversation_archive WHERE id = ?`)
          )
          return stmt.get(input.id)
        }) as Record<string, any> | undefined

        if (!row) return null

        return {
          id: row.id,
          sessionID: row.session_id,
          title: row.title,
          subject: row.subject,
          summary: row.summary,
          tags: row.tags ? JSON.parse(row.tags) : [],
          tokenCount: row.token_count,
          messageCount: row.message_count,
          compactedSummary: row.compacted_summary,
          created: row.time_created,
        }
      })

    return ArchiveService.of({ archive, search, getIndex, recall })
  }),
)

export const defaultLayer = layer

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

export * as ArchiveService from "./archive"
