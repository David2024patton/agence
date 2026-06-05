import { Catalog } from "@agence-ai/core/catalog"
import { Location } from "@agence-ai/core/location"
import { LocationServiceMap } from "@agence-ai/core/location-layer"
import { PluginBoot } from "@agence-ai/core/plugin/boot"
import { AppFileSystem } from "@agence-ai/core/filesystem"
import { assertProjectDirectory } from "@/project/require-project"
import { Effect, Layer, Schema } from "effect"
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import { HttpApiMiddleware, OpenApi } from "effect/unstable/httpapi"
import { InvalidRequestError } from "../../errors"

export const LocationQuery = Schema.Struct({
  location: Schema.optional(
    Schema.Struct({
      directory: Schema.optional(Schema.String),
      workspace: Schema.optional(Schema.String),
    }),
  ),
}).annotate({ identifier: "V2LocationQuery" })

export const locationQueryOpenApi = OpenApi.annotations({
  transform: (operation) => {
    const parameters = operation.parameters
    if (!Array.isArray(parameters)) return operation
    return {
      ...operation,
      parameters: parameters.map((parameter) =>
        parameter?.name === "location" && parameter?.in === "query"
          ? { ...parameter, style: "deepObject", explode: true }
          : parameter,
      ),
    }
  },
})

export class V2LocationMiddleware extends HttpApiMiddleware.Service<
  V2LocationMiddleware,
  {
    provides: Catalog.Service | PluginBoot.Service
  }
>()("@agence/ExperimentalHttpApiV2Location") {}

function decodeDirectory(input: string) {
  try {
    return decodeURIComponent(input)
  } catch {
    return input
  }
}

function directoryFromRequest(request: HttpServerRequest.HttpServerRequest) {
  const query = new URL(request.url, "http://localhost").searchParams
  const fromQuery = query.get("location[directory]")
  if (fromQuery) return decodeDirectory(fromQuery)
  const fromHeader = request.headers["x-opencode-directory"]
  if (typeof fromHeader === "string" && fromHeader.length > 0) return decodeDirectory(fromHeader)
  return ""
}

function ref(request: HttpServerRequest.HttpServerRequest, directory: string): Location.Ref {
  const query = new URL(request.url, "http://localhost").searchParams
  return {
    directory,
    workspaceID: query.get("location[workspace]") || request.headers["x-opencode-workspace"],
  }
}

export const layer = Layer.effect(
  V2LocationMiddleware,
  Effect.gen(function* () {
    const locations = yield* LocationServiceMap
    return V2LocationMiddleware.of((effect) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest
        const normalizedResult = yield* assertProjectDirectory(directoryFromRequest(request)).pipe(
          Effect.provide(AppFileSystem.defaultLayer),
          Effect.map((dir) => ({ success: true as const, directory: dir })),
          Effect.catch((error) =>
            Effect.succeed({
              success: false as const,
              response: HttpServerResponse.jsonUnsafe(
                new InvalidRequestError({
                  message: String((error as any).message ?? error),
                  kind: "Query",
                  field: "location[directory]",
                }),
                { status: 400 },
              ),
            }),
          ),
        )
        if (!normalizedResult.success) {
          return normalizedResult.response
        }
        return yield* effect.pipe(Effect.provide(locations.get(ref(request, normalizedResult.directory))))
      }),
    )
  }),
).pipe(Layer.provide(LocationServiceMap.layer))
