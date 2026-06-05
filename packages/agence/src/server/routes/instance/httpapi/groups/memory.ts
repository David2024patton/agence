import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { Authorization } from "../middleware/authorization"
import { InstanceContextMiddleware } from "../middleware/instance-context"
import { WorkspaceRoutingMiddleware, WorkspaceRoutingQuery, WorkspaceRoutingQueryFields } from "../middleware/workspace-routing"
import { MemorySettings } from "@/learning/memory-settings"
import { QueryBoolean } from "./query"

const MemoryItem = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  source: Schema.String,
  layer: Schema.String,
  concept: Schema.String,
  description: Schema.String,
  importance: Schema.optional(Schema.String),
  tags: Schema.Array(Schema.String),
  decay: Schema.Number,
  timeCreated: Schema.Number,
  scope: Schema.Literals(["project", "global"] as const),
})

const MemoryStats = Schema.Struct({
  total: Schema.Number,
  byLayer: Schema.Record(Schema.String, Schema.Number),
  byTag: Schema.Record(Schema.String, Schema.Number),
  globalCount: Schema.Number,
})

const MemoryState = Schema.Struct({
  settings: MemorySettings,
  stats: MemoryStats,
  recent: Schema.Array(MemoryItem),
})

const MaintenanceResult = Schema.Struct({
  merged: Schema.Number,
  redundant: Schema.Number,
  pruned: Schema.Number,
  exported: Schema.optional(
    Schema.Struct({
      path: Schema.String,
      count: Schema.Number,
    }),
  ),
})

const DeletePayload = Schema.Struct({
  ids: Schema.Array(Schema.String),
})

const IngestPayload = Schema.Struct({
  filename: Schema.String,
  contentBase64: Schema.String,
  layer: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Schema.String)),
  scope: Schema.optional(Schema.Literals(["project", "global"] as const)),
})

const IngestResult = Schema.Struct({
  chunks: Schema.Number,
  filename: Schema.String,
  savedPath: Schema.optional(Schema.String),
})

const MemoryListQuery = Schema.Struct({
  ...WorkspaceRoutingQueryFields,
  layer: Schema.optional(Schema.String),
  includeGlobal: Schema.optional(QueryBoolean),
  limit: Schema.optional(Schema.NumberFromString),
})

export const MemoryApi = HttpApi.make("memory").add(
  HttpApiGroup.make("memory")
    .add(
      HttpApiEndpoint.get("state", "/memory/state", {
        query: WorkspaceRoutingQuery,
        success: MemoryState,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "memory.state",
          summary: "Memory settings and overview",
        }),
      ),
    )
    .add(
      HttpApiEndpoint.get("list", "/memory/list", {
        query: MemoryListQuery,
        success: Schema.Array(MemoryItem),
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "memory.list",
          summary: "List stored learnings",
        }),
      ),
    )
    .add(
      HttpApiEndpoint.post("settings", "/memory/settings", {
        query: WorkspaceRoutingQuery,
        payload: MemorySettings,
        success: MemorySettings,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "memory.settings",
          summary: "Update memory capture settings",
        }),
      ),
    )
    .add(
      HttpApiEndpoint.post("maintenance", "/memory/maintenance", {
        query: WorkspaceRoutingQuery,
        success: MaintenanceResult,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "memory.maintenance",
          summary: "Consolidate and prune project memories",
        }),
      ),
    )
    .add(
      HttpApiEndpoint.post("export", "/memory/export", {
        query: WorkspaceRoutingQuery,
        success: Schema.Struct({
          path: Schema.String,
          count: Schema.Number,
        }),
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "memory.export",
          summary: "Export memories to JSON for external sync",
        }),
      ),
    )
    .add(
      HttpApiEndpoint.post("delete", "/memory/delete", {
        query: WorkspaceRoutingQuery,
        payload: DeletePayload,
        success: Schema.Struct({ deleted: Schema.Number }),
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "memory.delete",
          summary: "Delete learnings by id",
        }),
      ),
    )
    .add(
      HttpApiEndpoint.post("ingest", "/memory/ingest", {
        query: WorkspaceRoutingQuery,
        payload: IngestPayload,
        success: IngestResult,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "memory.ingest",
          summary: "Import a document into project or global memory",
        }),
      ),
    )
    .middleware(InstanceContextMiddleware)
    .middleware(WorkspaceRoutingMiddleware)
    .middleware(Authorization),
)
