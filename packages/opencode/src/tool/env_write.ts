import { Effect, Schema } from "effect"
import { AppFileSystem } from "@opencode-ai/core/filesystem"
import { InstanceState } from "@/effect/instance-state"
import path from "path"
import * as Tool from "./tool"
import DESCRIPTION from "./env_write.txt"

export const Parameters = Schema.Struct({
  key: Schema.String.annotate({ description: "Environment variable name (e.g., GITHUB_TOKEN)" }),
  value: Schema.optional(Schema.String).annotate({
    description: "Value to set. Omit to delete the variable.",
  }),
})

export const EnvWriteTool = Tool.define(
  "env_write",
  Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: { key: string; value?: string }, _ctx: Tool.Context) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const envPath = path.join(instance.directory, ".env")
          let content = ""
          const exists = yield* fs.existsSafe(envPath)
          if (exists) {
            content = yield* fs.readFileString(envPath)
          }
          const lines = content.split("\n")
          const keyLower = params.key.toLowerCase()
          let found = false
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim()
            if (!line || line.startsWith("#")) continue
            const eq = line.indexOf("=")
            if (eq < 0) continue
            if (line.slice(0, eq).trim().toLowerCase() === keyLower) {
              if (params.value !== undefined) {
                lines[i] = `${params.key}=${params.value}`
              } else {
                lines.splice(i, 1)
                i--
              }
              found = true
              break
            }
          }
          if (!found && params.value !== undefined) {
            if (lines.length && lines[lines.length - 1].trim() !== "") lines.push("")
            lines.push(`${params.key}=${params.value}`)
          }
          yield* fs.writeWithDirs(envPath, lines.join("\n"))
          const action = params.value !== undefined ? (found ? "updated" : "added") : "removed"
          return {
            title: ".env",
            metadata: { key: params.key, action } as Record<string, unknown>,
            output: `${action.toUpperCase()}: ${params.key}` + (params.value ? ` = ${params.value}` : ""),
          }
        }).pipe(Effect.orDie),
    }
  }),
)
