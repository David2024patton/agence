import { Effect, pipe } from "effect"
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi"
import path from "path"
import { AppFileSystem } from "@agence-ai/core/filesystem"
import { InstanceState } from "@/effect/instance-state"
import { withProjectInstance } from "./instance-scope"
import {
  GLOBAL_MEMORY_PROJECT_ID,
  deleteLearningForProject,
  listLearnings,
} from "@/learning/index"
import {
  MAX_MEMORY_IMPORT_BYTES,
  extractDocumentText,
  isSupportedMemoryImport,
} from "@/learning/memory-document"
import {
  consolidateProjectLearnings,
  ensureGlobalMemoryProject,
  exportProjectMemories,
  ingestDocumentTextToMemory,
  pruneRedundantLearnings,
  pruneStaleLearnings,
  type MemoryLayer,
} from "@/learning/memory-intelligence"
import {
  currentMemorySettings,
  saveMemorySettings,
  type MemorySettings,
} from "@/learning/memory-settings"
import { InstanceHttpApi } from "../api"

function toMemoryItem(
  learning: {
    id: string
    projectId: string
    source: string
    concept: string
    description: string
    metadata?: Record<string, unknown>
    timeCreated: number
    decay?: number
  },
  projectId: string,
) {
  const meta = learning.metadata ?? {}
  const layer = typeof meta.layer === "string" ? meta.layer : learning.source
  const importance = typeof meta.importance === "string" ? meta.importance : undefined
  const tags = Array.isArray(meta.tags) ? (meta.tags as string[]) : []
  return {
    id: learning.id,
    projectId: learning.projectId,
    source: learning.source,
    layer,
    concept: learning.concept,
    description: learning.description,
    importance,
    tags,
    decay: learning.decay ?? 0,
    timeCreated: learning.timeCreated,
    scope: learning.projectId === GLOBAL_MEMORY_PROJECT_ID ? ("global" as const) : ("project" as const),
  }
}

function statsFrom(items: ReturnType<typeof toMemoryItem>[]) {
  const byLayer: Record<string, number> = {}
  const byTag: Record<string, number> = {}
  for (const item of items) {
    byLayer[item.layer] = (byLayer[item.layer] ?? 0) + 1
    for (const tag of item.tags) byTag[tag] = (byTag[tag] ?? 0) + 1
  }
  return {
    total: items.length,
    byLayer,
    byTag,
    globalCount: items.filter((i) => i.scope === "global").length,
  }
}

import { InvalidRequestError } from "../errors"

export const memoryHandlers = HttpApiBuilder.group(InstanceHttpApi, "memory", (handlers) =>
  Effect.gen(function* () {
    const stateHandler = Effect.fn("MemoryHttpApi.state")(function* () {
      return yield* withProjectInstance((_directory) =>
        Effect.gen(function* () {
          const ctx = yield* InstanceState.context
          const settings = yield* currentMemorySettings()
          const rows = yield* listLearnings({
            projectId: ctx.project.id,
            includeGlobal: true,
            limit: 250,
          })
          const items = rows.map((r) => toMemoryItem(r, ctx.project.id))
          return {
            settings,
            stats: statsFrom(items),
            recent: items.slice(0, 40),
          }
        }),
      ).pipe(
        Effect.catch((error) =>
          Effect.fail(
            new InvalidRequestError({
              message: String(error),
              kind: "Query",
              field: "directory",
            }),
          ),
        ),
      )
    })

    const listHandler = Effect.fn("MemoryHttpApi.list")(function* (ctx: {
      query: { layer?: string; includeGlobal?: boolean; limit?: number }
    }) {
      return yield* withProjectInstance((_directory) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const rows = yield* listLearnings({
            projectId: instance.project.id,
            layer: ctx.query.layer,
            includeGlobal: ctx.query.includeGlobal !== false,
            limit: ctx.query.limit ?? 200,
          })
          return rows.map((r) => toMemoryItem(r, instance.project.id))
        }),
      ).pipe(
        Effect.catch((error) =>
          Effect.fail(
            new InvalidRequestError({
              message: String(error),
              kind: "Query",
              field: "directory",
            }),
          ),
        ),
      )
    })

    const settingsHandler = Effect.fn("MemoryHttpApi.settings")(function* (ctx: {
      payload: MemorySettings
    }) {
      return yield* pipe(
        saveMemorySettings(ctx.payload),
        Effect.catch((error) =>
          Effect.fail(
            new InvalidRequestError({
              message: String(error),
              kind: "Query",
              field: "directory",
            }),
          ),
        ),
      )
    })

    const maintenanceHandler = Effect.fn("MemoryHttpApi.maintenance")(function* () {
      return yield* withProjectInstance((_directory) =>
        Effect.gen(function* () {
          const ctx = yield* InstanceState.context
          const settings = yield* currentMemorySettings()
          const merged =
            settings.autoConsolidate === false ? 0 : yield* consolidateProjectLearnings(ctx.project.id)
          const redundant =
            settings.autoPruneRedundant === false ? 0 : yield* pruneRedundantLearnings(ctx.project.id)
          const pruned = settings.autoPruneStale === false ? 0 : yield* pruneStaleLearnings(ctx.project.id)
          const exported =
            settings.exportOnMaintenance === true
              ? yield* pipe(
                  exportProjectMemories(ctx.project.id),
                  Effect.catch(() => Effect.succeed(undefined)),
                )
              : undefined
          return { merged, redundant, pruned, exported }
        }),
      ).pipe(
        Effect.catch((error) =>
          Effect.fail(
            new InvalidRequestError({
              message: String(error),
              kind: "Query",
              field: "directory",
            }),
          ),
        ),
      )
    })

    const exportHandler = Effect.fn("MemoryHttpApi.export")(function* () {
      return yield* withProjectInstance((_directory) =>
        Effect.gen(function* () {
          const ctx = yield* InstanceState.context
          return yield* exportProjectMemories(ctx.project.id)
        }),
      ).pipe(
        Effect.catch((error) =>
          Effect.fail(
            new InvalidRequestError({
              message: String(error),
              kind: "Query",
              field: "directory",
            }),
          ),
        ),
      )
    })

    const deleteHandler = Effect.fn("MemoryHttpApi.delete")(function* (ctx: {
      payload: { ids: readonly string[] }
    }) {
      return yield* withProjectInstance((_directory) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          let deleted = 0
          for (const id of ctx.payload.ids) {
            yield* deleteLearningForProject(id, instance.project.id)
            deleted++
          }
          return { deleted }
        }),
      ).pipe(
        Effect.catch((error) =>
          Effect.fail(
            new InvalidRequestError({
              message: String(error),
              kind: "Query",
              field: "directory",
            }),
          ),
        ),
      )
    })

    const ingestHandler = Effect.fn("MemoryHttpApi.ingest")(function* (ctx: {
      payload: {
        filename: string
        contentBase64: string
        layer?: string
        tags?: readonly string[]
        scope?: "project" | "global"
      }
    }) {
      return yield* withProjectInstance((_directory) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const settings = yield* currentMemorySettings()
          const filename = path.basename(ctx.payload.filename.trim())
          if (!filename) return yield* Effect.fail(new Error("Filename is required"))
          if (!isSupportedMemoryImport(filename)) return yield* Effect.fail(new Error("Unsupported file type"))

          const buffer = yield* Effect.try({
            try: () => Buffer.from(ctx.payload.contentBase64, "base64"),
            catch: () => new Error("Invalid base64 encoding"),
          })
          if (buffer.byteLength === 0 || buffer.byteLength > MAX_MEMORY_IMPORT_BYTES) {
            return yield* Effect.fail(new Error("Invalid file size"))
          }

          const text = yield* Effect.tryPromise({
            try: () => extractDocumentText(buffer, filename),
            catch: () => new Error("Failed to extract document text"),
          })
          if (!text.trim()) return yield* Effect.fail(new Error("Document is empty"))

          const scope = ctx.payload.scope ?? "project"
          if (scope === "global") yield* ensureGlobalMemoryProject()
          const projectId = scope === "global" ? GLOBAL_MEMORY_PROJECT_ID : instance.project.id

          const layer = (ctx.payload.layer ?? settings.defaultImportLayer ?? "experience") as MemoryLayer
          const tags = [...(ctx.payload.tags ?? ["knowledge", "import", "docs"])]

          let savedPath: string | undefined
          if (settings.saveImportedDocuments !== false) {
            const fs = yield* AppFileSystem.Service
            const importsDir = path.join(instance.directory, ".agence", "memory-imports")
            const safeName = filename.replace(/[^\w.\-()+ ]/g, "_")
            const dest = path.join(importsDir, `${Date.now()}-${safeName}`)
            yield* pipe(
              fs.writeWithDirs(dest, buffer),
              Effect.catch(() => Effect.void)
            )
            savedPath = path.relative(instance.directory, dest).replace(/\\/g, "/")
          }

          const docKey = `imports/${filename}`
          const result = yield* ingestDocumentTextToMemory({
            projectId,
            directory: instance.directory,
            docKey,
            text,
            layer,
            tags,
          })

          return { chunks: result.chunks, filename, savedPath }
        }),
      ).pipe(
        Effect.catch((error) =>
          Effect.fail(
            new InvalidRequestError({
              message: String((error as any).message ?? error),
              kind: "Query",
              field: "directory",
            }),
          ),
        ),
      )
    })

    return handlers
      .handle("state", stateHandler)
      .handle("list", listHandler)
      .handle("settings", settingsHandler)
      .handle("maintenance", maintenanceHandler)
      .handle("export", exportHandler)
      .handle("delete", deleteHandler)
      .handle("ingest", ingestHandler)
  }),
)
