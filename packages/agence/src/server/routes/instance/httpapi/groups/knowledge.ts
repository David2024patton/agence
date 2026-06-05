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

const KnowledgeState = Schema.Struct({
  path: Schema.String,
  exists: Schema.Boolean,
  articleCount: Schema.Number,
  files: Schema.Array(WikiFile),
})

export const KnowledgeApi = HttpApi.make("knowledge").add(
  HttpApiGroup.make("knowledge")
    .add(
      HttpApiEndpoint.get("state", "/knowledge/state", {
        query: WorkspaceRoutingQuery,
        success: KnowledgeState,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "knowledge.state",
          summary: "Project wiki knowledge base overview",
        }),
      ),
    )
    .add(
      HttpApiEndpoint.get("list", "/knowledge/list", {
        query: WorkspaceRoutingQuery,
        success: Schema.Struct({
          path: Schema.String,
          files: Schema.Array(WikiFile),
        }),
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "knowledge.list",
          summary: "List wiki articles (alias of library list)",
        }),
      ),
    )
    .middleware(WorkspaceRoutingMiddleware)
    .middleware(Authorization),
)
