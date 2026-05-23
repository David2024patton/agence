import { Effect, Schema } from "effect"
import { AppFileSystem } from "@opencode-ai/core/filesystem"
import { InstanceState } from "@/effect/instance-state"
import path from "path"
import * as Tool from "./tool"
import DESCRIPTION from "./os_open.txt"

export const Parameters = Schema.Struct({
  path: Schema.String.annotate({ description: "File path, directory path, or URL to open" }),
})

export const OsOpenTool = Tool.define(
  "os_open",
  Effect.gen(function* () {
    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: { path: string }, _ctx: Tool.Context) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const target = path.isAbsolute(params.path) ? params.path : path.resolve(instance.directory, params.path)
          const { execSync } = yield* Effect.sync(() => require("node:child_process"))
          if (process.platform === "win32") {
            execSync(`start "" "${target}"`, { shell: "cmd.exe" })
          } else if (process.platform === "darwin") {
            execSync(`open "${target}"`)
          } else {
            execSync(`xdg-open "${target}"`)
          }
          return {
            title: path.basename(target),
            metadata: { path: target } as Record<string, unknown>,
            output: `Opened: ${target}`,
          }
        }).pipe(Effect.orDie),
    }
  }),
)
