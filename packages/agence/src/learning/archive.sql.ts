import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core"
import { ProjectTable } from "../project/project.sql"
import { SessionTable } from "../session/session.sql"
import { Timestamps } from "../storage/schema.sql"
import type { ProjectID } from "../project/schema"
import type { SessionID } from "../session/schema"

export const ConversationArchiveTable = sqliteTable(
  "conversation_archive",
  {
    id: text().primaryKey(),
    project_id: text()
      .$type<ProjectID>()
      .notNull()
      .references(() => ProjectTable.id, { onDelete: "cascade" }),
    session_id: text()
      .$type<SessionID>()
      .notNull()
      .references(() => SessionTable.id, { onDelete: "cascade" }),
    title: text().notNull(),           // Auto-generated or user-provided title
    summary: text().notNull(),         // Structured summary (Goal → Progress → Next Steps)
    subject: text().notNull(),         // Primary subject/topic for indexing
    tags: text(),                      // JSON array of tags for categorization
    embedding: text(),                 // JSON float array for semantic search
    token_count: integer().notNull(),  // Total tokens in conversation
    message_count: integer().notNull(),// Number of messages
    compacted_summary: text(),         // The compaction summary that triggered archival
    ...Timestamps,
  },
  (table) => [
    // Indexes for fast lookups
  ],
)
