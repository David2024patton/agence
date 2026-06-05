import { Effect, Option } from "effect"
import { HttpServerRequest } from "effect/unstable/http"
import { AppFileSystem } from "@agence-ai/core/filesystem"
import { InstanceStore } from "@/project/instance-store"
import { assertProjectDirectory, NotAgenceProjectError } from "@/project/require-project"
import { InvalidRequestError } from "../errors"
import { WorkspaceRouteContext } from "../middleware/workspace-routing"

function decodeDirectory(input: string) {
  try {
    return decodeURIComponent(input)
  } catch {
    return input
  }
}

export function routeDirectory() {
  return Effect.gen(function* () {
    const route = yield* Effect.serviceOption(WorkspaceRouteContext)
    if (Option.isSome(route)) return decodeDirectory((route.value as WorkspaceRouteContext).directory)
    const request = yield* HttpServerRequest.HttpServerRequest
    const url = new URL(request.url, "http://localhost")
    const fromQuery = url.searchParams.get("directory")
    if (fromQuery) return decodeDirectory(fromQuery)
    const fromHeader = request.headers["x-opencode-directory"]
    if (typeof fromHeader === "string" && fromHeader.length > 0) return decodeDirectory(fromHeader)
    return ""
  })
}

function mapProjectError<A, E, R>(effect: Effect.Effect<A, E, R>) {
  return effect.pipe(
    Effect.provide(AppFileSystem.defaultLayer),
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
}

/** Wiki/library routes only need a resolved project path — avoid full instance bootstrap. */
export function withProjectDirectory<A, E, R>(run: (directory: string) => Effect.Effect<A, E, R>) {
  return mapProjectError(
    Effect.gen(function* () {
      const directory = yield* routeDirectory()
      const normalized = yield* assertProjectDirectory(directory)
      return yield* run(normalized)
    }),
  )
}

/** Hub, memory, and similar routes need a loaded project instance (Agent, DB project id, …). */
export function withProjectInstance<A, E, R>(run: (directory: string) => Effect.Effect<A, E, R>) {
  return mapProjectError(
    Effect.gen(function* () {
      const directory = yield* routeDirectory()
      const normalized = yield* assertProjectDirectory(directory)
      const store = yield* InstanceStore.Service
      return yield* store.provide({ directory: normalized }, run(normalized))
    }),
  )
}
