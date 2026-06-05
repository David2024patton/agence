import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { Authorization } from "../middleware/authorization"
import { WorkspaceRoutingMiddleware, WorkspaceRoutingQuery } from "../middleware/workspace-routing"

const WikiFile = Schema.Struct({
  name: Schema.String,
  content: Schema.String,
  links: Schema.Array(Schema.String),
  backlinks: Schema.Array(Schema.String),
})

const LibraryListResponse = Schema.Struct({
  path: Schema.String,
  files: Schema.Array(WikiFile),
})

const HeartbeatTask = Schema.Struct({
  enabled: Schema.Boolean,
  interval: Schema.String,
  taskName: Schema.String,
  prompt: Schema.String,
  intervalMs: Schema.optional(Schema.Number),
  lastRun: Schema.optional(Schema.Number),
  nextRunInMs: Schema.optional(Schema.Number),
})

const HeartbeatState = Schema.Struct({
  path: Schema.String,
  exists: Schema.Boolean,
  content: Schema.String,
  tasks: Schema.Array(HeartbeatTask),
})

const HeartbeatSavePayload = Schema.Struct({
  tasks: Schema.Array(
    Schema.Struct({
      enabled: Schema.Boolean,
      interval: Schema.String,
      taskName: Schema.String,
      prompt: Schema.String,
    }),
  ),
  preamble: Schema.optional(Schema.String),
})

export const LibraryApi = HttpApi.make("library").add(
  HttpApiGroup.make("library")
    .add(
      HttpApiEndpoint.get("list", "/library/list", {
        query: WorkspaceRoutingQuery,
        success: LibraryListResponse,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "library.list",
          summary: "List project wiki articles",
        }),
      ),
    )
    .add(
      HttpApiEndpoint.get("heartbeatState", "/library/heartbeat/state", {
        query: WorkspaceRoutingQuery,
        success: HeartbeatState,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "library.heartbeat.state",
          summary: "Heartbeat tasks and schedule state",
        }),
      ),
    )
    .add(
      HttpApiEndpoint.post("heartbeatSave", "/library/heartbeat/save", {
        query: WorkspaceRoutingQuery,
        payload: HeartbeatSavePayload,
        success: HeartbeatState,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "library.heartbeat.save",
          summary: "Save heartbeat tasks to HEARTBEAT.md",
        }),
      ),
    )
    .add(
      HttpApiEndpoint.post("heartbeatInit", "/library/heartbeat/init", {
        query: WorkspaceRoutingQuery,
        success: HeartbeatState,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "library.heartbeat.init",
          summary: "Create default HEARTBEAT.md for this project",
        }),
      ),
    )
    .middleware(WorkspaceRoutingMiddleware)
    .middleware(Authorization),
)
