import { Effect } from "effect"
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi"
import { InstanceState } from "@/effect/instance-state"
import {
  GLOBAL_MEMORY_PROJECT_ID,
  deleteLearning,
  listLearnings,
} from "@/learning/index"
import {
  consolidateProjectLearnings,
  exportProjectMemories,
  pruneRedundantLearnings,
  pruneStaleLearnings,
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

export const memoryHandlers = HttpApiBuilder.group(InstanceHttpApi, "memory", (handlers) =>
  Effect.gen(function* () {
    const stateHandler = Effect.fn("MemoryHttpApi.state")(function* () {
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
    })

    const listHandler = Effect.fn("MemoryHttpApi.list")(function* (ctx: {
      query: { layer?: string; includeGlobal?: boolean; limit?: number }
    }) {
      const instance = yield* InstanceState.context
      const rows = yield* listLearnings({
        projectId: instance.project.id,
        layer: ctx.query.layer,
        includeGlobal: ctx.query.includeGlobal !== false,
        limit: ctx.query.limit ?? 200,
      })
      return rows.map((r) => toMemoryItem(r, instance.project.id))
    })

    const settingsHandler = Effect.fn("MemoryHttpApi.settings")(function* (ctx: {
      payload: MemorySettings
    }) {
      return yield* saveMemorySettings(ctx.payload).pipe(
        Effect.mapError(() => new HttpApiError.BadRequest({})),
      )
    })

    const maintenanceHandler = Effect.fn("MemoryHttpApi.maintenance")(function* () {
      const ctx = yield* InstanceState.context
      const settings = yield* currentMemorySettings()
      const merged = yield* consolidateProjectLearnings(ctx.project.id)
      const redundant = yield* pruneRedundantLearnings(ctx.project.id)
      const pruned = yield* pruneStaleLearnings(ctx.project.id)
      const exported =
        settings.exportOnMaintenance === true
          ? yield* exportProjectMemories(ctx.project.id).pipe(Effect.catch(() => Effect.succeed(undefined)))
          : undefined
      return { merged, redundant, pruned, exported }
    })

    const exportHandler = Effect.fn("MemoryHttpApi.export")(function* () {
      const ctx = yield* InstanceState.context
      return yield* exportProjectMemories(ctx.project.id)
    })

    const deleteHandler = Effect.fn("MemoryHttpApi.delete")(function* (ctx: {
      payload: { ids: readonly string[] }
    }) {
      let deleted = 0
      for (const id of ctx.payload.ids) {
        yield* deleteLearning(id)
        deleted++
      }
      return { deleted }
    })

    return handlers
      .handle("state", stateHandler)
      .handle("list", listHandler)
      .handle("settings", settingsHandler)
      .handle("maintenance", maintenanceHandler)
      .handle("export", exportHandler)
      .handle("delete", deleteHandler)
  }),
)
