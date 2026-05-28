import { Effect } from "effect"
import { Database } from "@/storage/db"
import { eq, asc } from "drizzle-orm"
import { ConversationArchiveTable } from "./archive.sql"
import { getEmbedding, cosineSimilarity } from "./index"
import { InstanceState } from "@/effect/instance-state"
import { AppFileSystem } from "@agence-ai/core/filesystem"
import path from "path"
import type { SessionID } from "../session/schema"

export interface ConversationArchive {
  id: string
  projectId: string
  sessionId: string
  title: string
  summary: string
  subject: string
  tags: string[]
  embedding?: number[]
  tokenCount: number
  messageCount: number
  compactedSummary?: string
  timeCreated: number
  score?: number
}

function uid(): string {
  return `conv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function extractSubject(summary: string): string {
  const goal = summary.match(/## Goal\s*\n\s*-?\s*(.+)/i)
  return goal?.[1]?.trim().slice(0, 120) || "Conversation archive"
}

function autoTitle(messages: { role?: string; content?: string; text?: string }[]): string {
  for (const msg of messages) {
    const text = msg.content || msg.text || ""
    if (text && text.length > 3) {
      return text.slice(0, 80)
    }
  }
  return "Untitled conversation"
}

function extractTags(messages: unknown[]): string[] {
  const tags = new Set<string>()
  try {
    for (const msg of messages) {
      const m = msg as Record<string, unknown>
      if (m.parts && Array.isArray(m.parts)) {
        for (const part of m.parts as Record<string, unknown>[]) {
          if (part.type === "tool" && part.tool) {
            tags.add(String(part.tool))
          }
        }
      }
    }
  } catch { /* best effort */ }
  return [...tags].slice(0, 20)
}

function dumpToKnowledgeBase(input: {
  instance: { directory: string }
  id: string
  title: string
  subject: string
  summary: string
  tags: string[]
}) {
  return Effect.gen(function* () {
    const fsOption = yield* Effect.serviceOption(AppFileSystem.Service)
    if (fsOption._tag === "None") return

    const fs = fsOption.value
    const kbRawDir = path.join(input.instance.directory, ".agence", "knowledge", "raw")

    const hasKB = yield* fs.existsSafe(kbRawDir)
    if (!hasKB) return

    const date = new Date().toISOString().split("T")[0]
    const slug = input.subject
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
    const filename = `${date}-conv-${slug || "archive"}-${input.id}.md`

    const content = [
      `# ${input.title}`,
      ``,
      `**Archive ID:** ${input.id}`,
      `**Date:** ${date}`,
      `**Subject:** ${input.subject}`,
      input.tags.length > 0 ? `**Tags:** ${input.tags.join(", ")}` : "",
      ``,
      `## Summary`,
      ``,
      input.summary,
      `---`,
      `_Auto-archived from conversation compaction. See \`memory_recall\` with ID \`${input.id}\` for raw conversation._`,
    ].filter(Boolean).join("\n")

    yield* fs.writeWithDirs(path.join(kbRawDir, filename), content)
  })
}

function parseSummarySections(summary: string) {
  const sections: Record<string, string[]> = {}
  let currentSection = ""
  for (const line of summary.split("\n")) {
    const match = line.match(/^##\s+(.+)/)
    if (match) {
      currentSection = match[1].trim()
      sections[currentSection] = []
    } else if (line.match(/^###\s+(.+)/)) {
      currentSection = line.match(/^###\s+(.+)/)![1].trim()
      sections[currentSection] = []
    } else if (currentSection && line.trim()) {
      sections[currentSection].push(line.trim())
    }
  }
  return sections
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60)
}

function extractListItems(section: Record<string, string[]>, key: string): string[] {
  return (section[key] || []).filter((l) => l.startsWith("-")).map((l) => l.replace(/^-\s*/, "").trim())
}

function upsertWiki(input: {
  instance: { directory: string }
  id: string
  title: string
  subject: string
  summary: string
  date: string
}) {
  return Effect.gen(function* () {
    const fsOption = yield* Effect.serviceOption(AppFileSystem.Service)
    if (fsOption._tag === "None") return
    const fs = fsOption.value

    const wikiDir = path.join(input.instance.directory, ".agence", "knowledge", "wiki")
    const hasWiki = yield* fs.existsSafe(wikiDir)
    if (!hasWiki) return

    const slug = slugify(input.subject) || "untitled"
    const pagePath = path.join(wikiDir, `${slug}.md`)
    const sections = parseSummarySections(input.summary)

    const goal = sections["Goal"]?.[0]?.replace(/^-\s*/, "") || input.subject
    const decisions = extractListItems(sections, "Key Decisions")
    const facts = extractListItems(sections, "Critical Context")
    const files = extractListItems(sections, "Relevant Files")
    const constraints = extractListItems(sections, "Constraints & Preferences")
    const done = extractListItems(sections, "Done")
    const inProgress = extractListItems(sections, "In Progress")
    const blocked = extractListItems(sections, "Blocked")

    let status = "Active"
    if (blocked.filter((b) => b !== "(none)").length > 0 && inProgress.filter((i) => i !== "(none)").length === 0) {
      status = "Blocked"
    } else if (done.filter((d) => d !== "(none)").length > 0 && inProgress.filter((i) => i !== "(none)").length === 0 && blocked.filter((b) => b !== "(none)").length === 0) {
      status = "Done"
    }

    let existing = ""
    if (yield* fs.existsSafe(pagePath)) {
      existing = yield* fs.readFileString(pagePath).pipe(Effect.catch(() => Effect.succeed("")))
    }

    const archiveEntry = `| ${input.date} | ${input.id} | ${goal.slice(0, 80)} |`
    const decisionLines = decisions.map((d) => `- ${d} (${input.date})`)
    const factLines = facts.filter((f) => f !== "(none)").map((f) => `- ${f}`)
    const constraintLines = constraints.filter((c) => c !== "(none)").map((c) => `- ${c}`)
    const fileLines = files.filter((f) => f !== "(none)").map((f) => `- ${f}`)

    let page = ""
    if (existing) {
      page = existing
      if (decisionLines.length > 0) {
        for (const dl of decisionLines) {
          if (!page.includes(dl)) page = page.replace(/(## Key Decisions\n)/, `$1${dl}\n`)
        }
      }
      if (archiveEntry && !page.includes(input.id)) {
        page = page.replace(/(\|[-| ]+\|)/, (m) => `${m}\n${archiveEntry}`)
      }
      if (factLines.length > 0) {
        for (const fl of factLines) {
          if (!page.includes(fl)) page = page.replace(/(## Key Facts\n)/, `$1${fl}\n`)
        }
      }
      if (fileLines.length > 0) {
        for (const fl of fileLines) {
          if (!page.includes(fl)) page = page.replace(/(## Relevant Files\n)/, `$1${fl}\n`)
        }
      }
      page = page.replace(/^## Status\n.*$/m, `## Status\n${status} (last updated: ${input.date})`)
    } else {
      page = [
        `# ${goal}`,
        ``,
        `## Status`,
        `${status} (last updated: ${input.date})`,
        ``,
        `## Goal`,
        goal,
        ...(constraintLines.length > 0 ? ["", "## Constraints"] : []),
        ...constraintLines,
        ...(decisionLines.length > 0 ? ["", "## Key Decisions"] : []),
        ...decisionLines,
        ...(factLines.length > 0 ? ["", "## Key Facts"] : []),
        ...factLines,
        ...(fileLines.length > 0 ? ["", "## Relevant Files"] : []),
        ...fileLines,
        ``,
        `## Archives`,
        `| Date | ID | Summary |`,
        `|------|----|---------|`,
        archiveEntry,
      ].join("\n")
    }

    yield* fs.writeWithDirs(pagePath, page)

    const indexPath = path.join(wikiDir, "index.md")
    let index = ""
    if (yield* fs.existsSafe(indexPath)) {
      index = yield* fs.readFileString(indexPath).pipe(Effect.catch(() => Effect.succeed("")))
    }
    const entryLine = `- [${goal}](./${slug}.md) — ${status.toLowerCase()}`
    if (!index.includes(`${slug}.md`)) {
      index = index + "\n" + entryLine
    } else {
      index = index.replace(new RegExp(`- \\[.+\\]\\(\\.\\/${slug}\\.md\\) — .+`), entryLine)
    }
    if (!index.startsWith("# ")) {
      index = `# Knowledge Base Index\n\n${index}`
    }
    yield* fs.writeWithDirs(indexPath, index)

    const memoryPath = path.join(input.instance.directory, ".agence", "knowledge", "memory.md")
    let memory = ""
    if (yield* fs.existsSafe(memoryPath)) {
      memory = yield* fs.readFileString(memoryPath).pipe(Effect.catch(() => Effect.succeed("")))
    }
    const logLine = `| ${input.date} | wiki upsert | ${slug}.md (${input.id}) |`
    memory = memory.replace(/^## Processing Log\n/, `## Processing Log\n| Date | Action | Files |\n|------|--------|-------|\n${logLine}\n`)
    if (!memory.includes("## Processing Log")) {
      memory += `\n## Processing Log\n| Date | Action | Files |\n|------|--------|-------|\n${logLine}\n`
    }
    yield* fs.writeWithDirs(memoryPath, memory)
  })
}

export const archiveConversation = (input: {
  sessionId: SessionID
  messages: unknown[]
  compactionSummary: string
  tokenCount: number
}) =>
  Effect.gen(function* () {
    const instance = yield* InstanceState.context
    const id = uid()
    const title = autoTitle(input.messages as { role?: string; content?: string; text?: string }[])
    const subject = extractSubject(input.compactionSummary)
    const tags = extractTags(input.messages)
    const date = new Date().toISOString().split("T")[0]
    const embeddingText = `${title}\n${subject}\n${input.compactionSummary}`
    const embedding = yield* getEmbedding(embeddingText)
    const embeddingJson = embedding.length > 0 ? JSON.stringify(embedding) : null

    yield* Effect.sync(() =>
      Database.transaction((db) => {
        db.insert(ConversationArchiveTable).values({
          id,
          project_id: instance.project.id as any,
          session_id: input.sessionId as any,
          title,
          summary: input.compactionSummary,
          subject,
          tags: tags.length > 0 ? JSON.stringify(tags) : null,
          embedding: embeddingJson,
          token_count: input.tokenCount,
          message_count: Array.isArray(input.messages) ? input.messages.length : 0,
          compacted_summary: input.compactionSummary,
          time_created: Date.now(),
          time_updated: Date.now(),
        } as any).run()
      }),
    )

    yield* dumpToKnowledgeBase({ instance, id, title, subject, summary: input.compactionSummary, tags }).pipe(
      Effect.ignore,
    )

    yield* upsertWiki({ instance, id, title, subject, summary: input.compactionSummary, date }).pipe(
      Effect.ignore,
    )

    return { id, title }
  })

export const searchArchives = (params: { projectId: string; query: string; limit?: number }) =>
  Effect.gen(function* () {
    const limit = params.limit ?? 10
    const queryEmbedding = yield* getEmbedding(params.query)

    const rows = yield* Effect.sync(() =>
      Database.use((db) =>
        db.select().from(ConversationArchiveTable)
          .where(eq(ConversationArchiveTable.project_id, params.projectId as any))
          .orderBy(asc(ConversationArchiveTable.time_created)).all(),
      ),
    )

    if (queryEmbedding.length === 0) {
      return rows.filter((r) =>
        r.title.toLowerCase().includes(params.query.toLowerCase()) ||
        r.summary.toLowerCase().includes(params.query.toLowerCase()) ||
        r.subject.toLowerCase().includes(params.query.toLowerCase()),
      ).slice(0, limit).map(rowToArchive)
    }

    return rows.map((r) => {
      const a = rowToArchive(r)
      const embed = r.embedding ? JSON.parse(r.embedding) as number[] : null
      a.score = embed ? cosineSimilarity(queryEmbedding, embed) : 0
      return a
    }).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, limit)
  })

export const getArchiveById = (id: string) =>
  Effect.sync(() =>
    Database.use((db) =>
      db.select().from(ConversationArchiveTable)
        .where(eq(ConversationArchiveTable.id, id)).get(),
    ),
  )

function rowToArchive(r: typeof ConversationArchiveTable.$inferSelect): ConversationArchive {
  return {
    id: r.id,
    projectId: r.project_id,
    sessionId: r.session_id,
    title: r.title,
    summary: r.summary,
    subject: r.subject,
    tags: r.tags ? JSON.parse(r.tags) : [],
    embedding: r.embedding ? JSON.parse(r.embedding) : undefined,
    tokenCount: r.token_count,
    messageCount: r.message_count,
    compactedSummary: r.compacted_summary ?? undefined,
    timeCreated: r.time_created,
  }
}
