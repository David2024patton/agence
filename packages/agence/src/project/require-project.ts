import path from "path"
import { AppFileSystem } from "@agence-ai/core/filesystem"
import { Effect, Schema } from "effect"

export class NotAgenceProjectError extends Schema.TaggedErrorClass<NotAgenceProjectError>()("NotAgenceProjectError", {
  message: Schema.String,
  directory: Schema.optional(Schema.String),
}) {}

export function assertProjectDirectory(directory: string) {
  return Effect.gen(function* () {
    const trimmed = directory.trim()
    if (!trimmed) {
      return yield* Effect.fail(
        new NotAgenceProjectError({
          message: "Open a project in Agence before using the agent, skills, MCPs, or personas.",
        }),
      )
    }

    const fs = yield* AppFileSystem.Service
    const normalized = path.resolve(trimmed)
    if (!(yield* fs.existsSafe(normalized))) {
      return yield* Effect.fail(
        new NotAgenceProjectError({
          message: "Project directory not found.",
          directory: normalized,
        }),
      )
    }

    const agenceDir = path.join(normalized, ".agence")
    if (!(yield* fs.existsSafe(agenceDir))) {
      const { ensureHubBundle } = yield* Effect.promise(() => import("./hub-bootstrap"))
      yield* ensureHubBundle(normalized)
    }

    return normalized
  })
}
