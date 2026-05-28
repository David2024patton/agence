import { Effect } from "effect"
import { ensureGlobalMemoryProject, ingestMarkdownDocToMemory } from "@/learning/memory-intelligence"
import { Database } from "@/storage/db"
import { LearningTable } from "@/learning/learning.sql"
import path from "path"

const DOC = "docs/solutions/prompt-footer-modes-and-memory-ui.md"
const PROJECT_ID = process.env.AGENCE_PROJECT_ID ?? "__global__"
const DIRECTORY = process.env.AGENCE_DIRECTORY ?? path.resolve(process.cwd(), "..", "..")

const program = Effect.gen(function* () {
  yield* ensureGlobalMemoryProject()
  yield* ingestMarkdownDocToMemory({
    projectId: PROJECT_ID,
    directory: DIRECTORY,
    docPath: DOC,
    layer: "experience",
    tags: ["knowledge", "debug", "fix", "ui", "workflow"],
  })

  const rows = yield* Effect.sync(() =>
    Database.use((db) =>
      db
        .select({ concept: LearningTable.concept })
        .from(LearningTable)
        .all()
        .filter((r) => (r.concept ?? "").startsWith(`doc:${DOC}#`)),
    ),
  )

  return { chunks: rows.length }
})

Effect.runPromise(program).then((res) => {
  // eslint-disable-next-line no-console
  console.log(`[ingest] stored ${res.chunks} chunks for ${DOC}`)
})

