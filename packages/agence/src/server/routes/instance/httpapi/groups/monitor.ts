import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/unstable/httpapi"
import { WorkspaceRoutingQuery } from "../middleware/workspace-routing"

const MonitorEvent = Schema.Struct({
  timestamp: Schema.Number,
  type: Schema.String,
  session_id: Schema.optional(Schema.String),
  properties: Schema.Record(Schema.String, Schema.Unknown),
})

const SessionInfo = Schema.Struct({
  id: Schema.String,
  status: Schema.String,
  created_at: Schema.Number,
  provider: Schema.optional(Schema.String),
  model: Schema.optional(Schema.String),
})

const MonitorState = Schema.Struct({
  server: Schema.Struct({
    uptime: Schema.Number,
    version: Schema.String,
    channel: Schema.String,
    healthy: Schema.Literal(true),
  }),
  sessions: Schema.Struct({
    active_count: Schema.Number,
    recent: Schema.Array(SessionInfo),
  }),
  events: Schema.Struct({
    recent: Schema.Array(MonitorEvent),
    errors: Schema.Array(MonitorEvent),
  }),
  commands: Schema.Struct({
    total: Schema.Number,
    recent: Schema.Array(MonitorEvent),
  }),
})

export const MonitorPaths = {
  state: "/monitor/state",
  events: "/monitor/events",
} as const

export const MonitorApi = HttpApi.make("monitor").add(
  HttpApiGroup.make("monitor")
    .add(
      HttpApiEndpoint.get("state", MonitorPaths.state, {
        query: WorkspaceRoutingQuery,
        success: MonitorState,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "monitor.state",
          summary: "Get monitoring state",
          description: "Current server state snapshot for LLM consumption",
        }),
      ),
    )
    .add(
      HttpApiEndpoint.get("events", MonitorPaths.events, {
        query: WorkspaceRoutingQuery,
        success: Schema.String.pipe(HttpApiSchema.asText({ contentType: "text/event-stream" })),
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "monitor.events",
          summary: "Subscribe to monitoring events",
          description: "Live SSE stream of structured monitoring events",
        }),
      ),
    )
    .annotateMerge(OpenApi.annotations({ title: "monitor", description: "Server monitoring routes." })),
)

export * as MonitorApi from "./monitor"
