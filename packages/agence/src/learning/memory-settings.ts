import { Effect, pipe } from "effect"
import path from "path"
import { AppFileSystem } from "@agence-ai/core/filesystem"
import { InstanceState } from "@/effect/instance-state"
import { Schema } from "effect"

export const MemorySettings = Schema.Struct({
  autoCaptureEnabled: Schema.optional(Schema.Boolean),
  capturePreferences: Schema.optional(Schema.Boolean),
  captureCorrections: Schema.optional(Schema.Boolean),
  captureToolFailures: Schema.optional(Schema.Boolean),
  autoConsolidate: Schema.optional(Schema.Boolean),
  autoPruneStale: Schema.optional(Schema.Boolean),
  autoPruneRedundant: Schema.optional(Schema.Boolean),
  exportOnMaintenance: Schema.optional(Schema.Boolean),
  globalRecall: Schema.optional(Schema.Boolean),
  minAutoImportance: Schema.optional(Schema.Literals(["low", "medium", "high"] as const)),
  saveImportedDocuments: Schema.optional(Schema.Boolean),
  defaultImportLayer: Schema.optional(Schema.Literals(["activity", "context", "experience", "identity", "preference"] as const)),
})

export type MemorySettings = Schema.Schema.Type<typeof MemorySettings>

export const defaultMemorySettings: MemorySettings = {
  autoCaptureEnabled: true,
  capturePreferences: true,
  captureCorrections: true,
  captureToolFailures: true,
  autoConsolidate: true,
  autoPruneStale: true,
  autoPruneRedundant: true,
  exportOnMaintenance: false,
  globalRecall: true,
  minAutoImportance: "low",
  saveImportedDocuments: true,
  defaultImportLayer: "experience",
}

function settingsPath(directory: string) {
  return path.join(directory, ".agence", "memory-settings.json")
}

export const loadMemorySettings = (directory: string) =>
  Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    const file = settingsPath(directory)
    if (!(yield* fs.existsSafe(file))) return defaultMemorySettings
    const raw = yield* pipe(
      fs.readFileString(file),
      Effect.catch(() => Effect.succeed("{}"))
    )
    const parsed = Schema.decodeUnknownOption(MemorySettings)(JSON.parse(raw))
    return parsed._tag === "Some" ? { ...defaultMemorySettings, ...parsed.value } : defaultMemorySettings
  })

export const saveMemorySettings = (input: MemorySettings) =>
  Effect.gen(function* () {
    const ctx = yield* InstanceState.context
    const fs = yield* AppFileSystem.Service
    const file = settingsPath(ctx.directory)
    const merged = { ...defaultMemorySettings, ...input }
    yield* fs.writeWithDirs(file, JSON.stringify(merged, null, 2))
    return merged
  })

export const currentMemorySettings = () =>
  Effect.gen(function* () {
    const ctx = yield* InstanceState.context
    return yield* loadMemorySettings(ctx.directory)
  })
