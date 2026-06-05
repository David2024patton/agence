import { Effect, pipe, Schema } from "effect"
import path from "path"
import { AppFileSystem } from "@agence-ai/core/filesystem"
import { InstanceState } from "@/effect/instance-state"

export const SkillOptSettings = Schema.Struct({
  enabled: Schema.optional(Schema.Boolean),
  autoAfterSession: Schema.optional(Schema.Boolean),
  maxEditChars: Schema.optional(Schema.Number),
  maxEditsPerCycle: Schema.optional(Schema.Number),
  minSessionMessages: Schema.optional(Schema.Number),
})

export type SkillOptSettings = Schema.Schema.Type<typeof SkillOptSettings>

export const defaultSkillOptSettings: SkillOptSettings = {
  enabled: true,
  autoAfterSession: true,
  maxEditChars: 800,
  maxEditsPerCycle: 3,
  minSessionMessages: 4,
}

function settingsPath(directory: string) {
  return path.join(directory, ".agence", "skill-opt-settings.json")
}

export const loadSkillOptSettings = (directory: string) =>
  Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    const file = settingsPath(directory)
    if (!(yield* fs.existsSafe(file))) return defaultSkillOptSettings
    const raw = yield* pipe(
      fs.readFileString(file),
      Effect.catch(() => Effect.succeed("{}")),
    )
    const parsed = Schema.decodeUnknownOption(SkillOptSettings)(JSON.parse(raw))
    return parsed._tag === "Some" ? { ...defaultSkillOptSettings, ...parsed.value } : defaultSkillOptSettings
  })

export const saveSkillOptSettings = (input: SkillOptSettings) =>
  Effect.gen(function* () {
    const ctx = yield* InstanceState.context
    const fs = yield* AppFileSystem.Service
    const file = settingsPath(ctx.directory)
    const merged = { ...defaultSkillOptSettings, ...input }
    yield* fs.writeWithDirs(file, JSON.stringify(merged, null, 2))
    return merged
  })

export const currentSkillOptSettings = () =>
  Effect.gen(function* () {
    const ctx = yield* InstanceState.context
    return yield* loadSkillOptSettings(ctx.directory)
  })
