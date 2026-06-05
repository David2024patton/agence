import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { getSkillOptOverview, runSkillOptMaintenance } from "@/learning/skill-opt"
import { saveSkillOptSettings, type SkillOptSettings } from "@/learning/skill-opt-settings"
import { InstanceHttpApi } from "../api"
import { withProjectDirectory, withProjectInstance } from "./instance-scope"
import { InvalidRequestError } from "../errors"

export const skillOptHandlers = HttpApiBuilder.group(InstanceHttpApi, "skillOpt", (handlers) =>
  Effect.gen(function* () {
    const state = Effect.fn("SkillOptHttpApi.state")(function* () {
      return yield* withProjectDirectory((directory) => getSkillOptOverview(directory)).pipe(
        Effect.catch((error) =>
          Effect.fail(
            new InvalidRequestError({
              message: String(error),
              kind: "Query",
              field: "directory",
            })
          )
        )
      )
    })

    const saveSettings = Effect.fn("SkillOptHttpApi.saveSettings")(function* (ctx: { payload: SkillOptSettings }) {
      return yield* withProjectInstance(() => saveSkillOptSettings(ctx.payload)).pipe(
        Effect.catch((error) =>
          Effect.fail(
            new InvalidRequestError({
              message: String(error),
              kind: "Query",
              field: "directory",
            })
          )
        )
      )
    })

    const run = Effect.fn("SkillOptHttpApi.run")(function* () {
      return yield* withProjectInstance(() => runSkillOptMaintenance()).pipe(
        Effect.catch((error) =>
          Effect.fail(
            new InvalidRequestError({
              message: String(error),
              kind: "Query",
              field: "directory",
            })
          )
        )
      )
    })

    return handlers.handle("state", state).handle("saveSettings", saveSettings).handle("run", run)
  }),
)
