import { Effect, Schema, Stream, Scope } from "effect"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import { ChildProcess } from "effect/unstable/process"
import * as Tool from "./tool"
import DESCRIPTION from "./drives.txt"

export const Parameters = Schema.Struct({})

export const DrivesTool = Tool.define(
  "drives",
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (_params: {}, _ctx: Tool.Context) =>
        Effect.scoped(
          Effect.gen(function* () {
            if (process.platform === "win32") {
              const proc = yield* spawner.spawn(
                ChildProcess.make("powershell.exe", [
                  "-NoLogo", "-NoProfile", "-NonInteractive", "-Command",
                  'Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{N="TotalGB";E={[math]::Round($_.Used/1GB+($_.Free/1GB),1)}}, @{N="FreeGB";E={[math]::Round($_.Free/1GB,1)}}, Root | ConvertTo-Json',
                ]),
              )
              const output = yield* Stream.decodeText(proc.all).pipe(
                Stream.runFold(() => "", (a: string, b: string) => a + b),
              )
              return {
                title: "System Drives",
                metadata: {} as Record<string, unknown>,
                output: String(output || "No drives found."),
              }
            }
            const proc = yield* spawner.spawn(
              ChildProcess.make("df", ["-h", "-T"]),
            )
            const output = yield* Stream.decodeText(proc.all).pipe(
              Stream.runFold(() => "", (a: string, b: string) => a + b),
            )
            return {
              title: "System Drives",
              metadata: {} as Record<string, unknown>,
              output: String(output || "No drives found."),
            }
          }),
        ).pipe(Effect.orDie),
    }
  }),
)
