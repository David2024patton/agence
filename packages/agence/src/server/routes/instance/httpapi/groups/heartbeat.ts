import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { Authorization } from "../middleware/authorization"
import { WorkspaceRoutingMiddleware, WorkspaceRoutingQuery } from "../middleware/workspace-routing"

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

export const HeartbeatApi = HttpApi.make("heartbeat").add(
  HttpApiGroup.make("heartbeat")
    .add(
      HttpApiEndpoint.get("state", "/heartbeat/state", {
        query: WorkspaceRoutingQuery,
        success: HeartbeatState,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "heartbeat.state",
          summary: "Heartbeat tasks and schedule state",
        }),
      ),
    )
    .add(
      HttpApiEndpoint.post("save", "/heartbeat/save", {
        query: WorkspaceRoutingQuery,
        payload: HeartbeatSavePayload,
        success: HeartbeatState,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "heartbeat.save",
          summary: "Save heartbeat tasks to HEARTBEAT.md",
        }),
      ),
    )
    .add(
      HttpApiEndpoint.post("init", "/heartbeat/init", {
        query: WorkspaceRoutingQuery,
        success: HeartbeatState,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "heartbeat.init",
          summary: "Create default HEARTBEAT.md for this project",
        }),
      ),
    )
    .middleware(WorkspaceRoutingMiddleware)
    .middleware(Authorization),
)
