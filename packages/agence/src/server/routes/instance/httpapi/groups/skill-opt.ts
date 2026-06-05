import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { Authorization } from "../middleware/authorization"
import { WorkspaceRoutingMiddleware, WorkspaceRoutingQuery } from "../middleware/workspace-routing"
import { SkillOptSettings } from "@/learning/skill-opt-settings"

const SkillOptSkill = Schema.Struct({
  name: Schema.String,
  path: Schema.String,
  version: Schema.Number,
  hash: Schema.optional(Schema.String),
})

const SkillOptOverview = Schema.Struct({
  settings: SkillOptSettings,
  state: Schema.Struct({
    rejected: Schema.Array(
      Schema.Struct({
        skill: Schema.String,
        edits: Schema.Array(Schema.Unknown),
        reason: Schema.String,
        at: Schema.Number,
      }),
    ),
    accepted: Schema.Array(
      Schema.Struct({
        skill: Schema.String,
        summary: Schema.String,
        at: Schema.Number,
      }),
    ),
    skills: Schema.Record(Schema.String, Schema.Struct({ version: Schema.Number, path: Schema.String, hash: Schema.String })),
  }),
  skills: Schema.Array(SkillOptSkill),
  acceptedCount: Schema.Number,
  rejectedCount: Schema.Number,
})

const SkillOptRunResult = Schema.Struct({
  optimized: Schema.Number,
  rejected: Schema.Number,
  sessionID: Schema.optional(Schema.String),
})

export const SkillOptApi = HttpApi.make("skillOpt").add(
  HttpApiGroup.make("skillOpt")
    .add(
      HttpApiEndpoint.get("state", "/skill-opt/state", {
        query: WorkspaceRoutingQuery,
        success: SkillOptOverview,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "skillOpt.state",
          summary: "SkillOpt settings, optimizer state, and discovered skills",
        }),
      ),
    )
    .add(
      HttpApiEndpoint.post("saveSettings", "/skill-opt/settings", {
        query: WorkspaceRoutingQuery,
        payload: SkillOptSettings,
        success: SkillOptSettings,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "skillOpt.saveSettings",
          summary: "Save SkillOpt settings for this project",
        }),
      ),
    )
    .add(
      HttpApiEndpoint.post("run", "/skill-opt/run", {
        query: WorkspaceRoutingQuery,
        success: SkillOptRunResult,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "skillOpt.run",
          summary: "Run SkillOpt maintenance on the latest session",
        }),
      ),
    )
    .middleware(WorkspaceRoutingMiddleware)
    .middleware(Authorization),
)
