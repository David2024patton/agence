import { InstanceRef, WorkspaceRef } from "@/effect/instance-ref"
import { InstanceStore } from "@/project/instance-store"
import { assertProjectDirectory } from "@/project/require-project"
import { AppFileSystem } from "@agence-ai/core/filesystem"
import { Effect, Layer } from "effect"
import { HttpRouter, HttpServerResponse } from "effect/unstable/http"
import { HttpApiMiddleware } from "effect/unstable/httpapi"
import { InvalidRequestError } from "../errors"
import { WorkspaceRouteContext } from "./workspace-routing"

export class InstanceContextMiddleware extends HttpApiMiddleware.Service<
  InstanceContextMiddleware,
  {
    requires: WorkspaceRouteContext
  }
>()("@agence/ExperimentalHttpApiInstanceContext") {}

function decode(input: string): string {
  try {
    return decodeURIComponent(input)
  } catch {
    return input
  }
}

function provideInstanceContext<E, R>(
  effect: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
  store: InstanceStore.Interface,
) {
  return Effect.gen(function* () {
    const route = yield* WorkspaceRouteContext
    const directory = decode(route.directory)
    const ctxResult = yield* assertProjectDirectory(directory).pipe(
      Effect.provide(AppFileSystem.defaultLayer),
      Effect.flatMap((normalized) => store.load({ directory: normalized })),
      Effect.map((ctx) => ({ success: true as const, value: ctx })),
      Effect.catch((error) =>
        Effect.succeed({
          success: false as const,
          response: HttpServerResponse.jsonUnsafe(
            new InvalidRequestError({
              message: error.message,
              kind: "Query",
              field: "directory",
            }),
            { status: 400 },
          ),
        }),
      ),
    )
    if (!ctxResult.success) {
      return ctxResult.response
    }
    return yield* effect.pipe(
      Effect.provideService(InstanceRef, ctxResult.value),
      Effect.provideService(WorkspaceRef, route.workspaceID),
    )
  })
}

export const instanceContextLayer = Layer.effect(
  InstanceContextMiddleware,
  Effect.gen(function* () {
    const store = yield* InstanceStore.Service
    return InstanceContextMiddleware.of((effect) => provideInstanceContext(effect, store) as any)
  }),
)

export const instanceRouterMiddleware = HttpRouter.middleware()(
  Effect.gen(function* () {
    const store = yield* InstanceStore.Service
    return (effect) => provideInstanceContext(effect, store)
  }),
) as any
