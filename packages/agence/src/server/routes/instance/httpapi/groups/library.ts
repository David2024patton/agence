import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { WorkspaceRoutingQuery } from "../middleware/workspace-routing"

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

export const LibraryApi = HttpApi.make("library").add(
  HttpApiGroup.make("library").add(
    HttpApiEndpoint.get("list", "/library/list", {
      query: WorkspaceRoutingQuery,
      success: LibraryListResponse,
    }).annotateMerge(
      OpenApi.annotations({
        identifier: "library.list",
        summary: "List project wiki articles",
      }),
    ),
  ),
)
