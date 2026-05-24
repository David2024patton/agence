import { Effect, Schema, Stream, Scope } from "effect"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import { ChildProcess } from "effect/unstable/process"
import * as Tool from "./tool"
import { InstanceState } from "@/effect/instance-state"
import DESCRIPTION from "./powershell.txt"

export const Parameters = Schema.Struct({
  command: Schema.String.annotate({ description: "PowerShell command to execute" }),
  timeout: Schema.optional(Schema.Number).annotate({
    description: "Timeout in milliseconds (default 60000)",
  }),
})

export const PowerShellTool = Tool.define(
  "powershell",
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: { command: string; timeout?: number }, _ctx: Tool.Context) =>
        Effect.scoped(
          Effect.gen(function* () {
            if (process.platform !== "win32") {
              return {
                title: "PowerShell",
                metadata: {} as Record<string, unknown>,
                output: "PowerShell is only available on Windows.",
              }
            }
            const instance = yield* InstanceState.context
            const proc = yield* spawner.spawn(
              ChildProcess.make("powershell.exe", [
                "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", params.command,
              ], { cwd: instance.directory }),
            )
            const output = yield* Stream.decodeText(proc.all).pipe(
              Stream.runFold(() => "", (a: string, b: string) => a + b),
            )
            return {
              title: `pwsh: ${params.command.slice(0, 60)}`,
              metadata: {} as Record<string, unknown>,
              output: String(output || "(no output)"),
            }
          }),
        ).pipe(Effect.orDie),
    }
  }),
)
