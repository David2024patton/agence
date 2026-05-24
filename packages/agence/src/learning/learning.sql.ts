import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core"
import { ProjectTable } from "../project/project.sql"
import { Timestamps } from "../storage/schema.sql"
import type { ProjectID } from "../project/schema"

export const LearningTable = sqliteTable(
  "learning",
  {
    id: text().primaryKey(),
    project_id: text()
      .$type<ProjectID>()
      .notNull()
      .references(() => ProjectTable.id, { onDelete: "cascade" }),
    source: text().notNull(),       // "reflect" | "model_learn" | "quality_gate"
    concept: text().notNull(),       // Short name for the concept/pattern
    description: text().notNull(),   // Full description
    embedding: text(),               // JSON array of floats (768-dim from nomic-embed-text)
    confidence: text().default("medium"),  // low | medium | high
    related_to: text(),              // JSON array of related concept IDs
    skill_path: text(),              // Path to SKILL.md if one was created
    metadata: text(),               // JSON blob for extra data
    ...Timestamps,
  },
  (table) => [
    // Index for project-scoped queries
  ],
)

export const EmbeddingCacheTable = sqliteTable(
  "embedding_cache",
  {
    hash: text().primaryKey(),       // SHA256 of the input text
    model: text().notNull(),         // "nomic-embed-text"
    embedding: text().notNull(),     // JSON array of floats
    dimensions: integer().notNull(),
    ...Timestamps,
  },
)
