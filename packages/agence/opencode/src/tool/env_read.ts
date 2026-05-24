import { Effect, Schema } from "effect"
import { AppFileSystem } from "@agence-ai/core/filesystem"
import { InstanceState } from "@/effect/instance-state"
import path from "path"
import * as Tool from "./tool"
import DESCRIPTION from "./env_read.txt"

export const Parameters = Schema.Struct({})

export const EnvReadTool = Tool.define(
  "env_read",
  Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (_params: {}, _ctx: Tool.Context) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const envPath = path.join(instance.directory, ".env")
          const exists = yield* fs.existsSafe(envPath)
          if (!exists) {
            return {
              title: "Environment",
              metadata: { count: 0 } as Record<string, unknown>,
              output: "No .env file found in project directory.",
            }
          }
          const content = yield* fs.readFileString(envPath)
          const lines = content.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"))
          const vars: Record<string, string> = {}
          for (const line of lines) {
            const eq = line.indexOf("=")
            if (eq > 0) {
              const key = line.slice(0, eq).trim()
              const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "")
              vars[key] = value
            }
          }
          const output = Object.entries(vars)
            .map(([key, value]) => {
              const masked = value.length > 20 ? value.slice(0, 8) + "..." + value.slice(-4) : value
              return `${key}=${masked}`
            })
            .join("\n")
          return {
            title: ".env",
            metadata: { count: Object.keys(vars).length } as Record<string, unknown>,
            output: output || "No variables found.",
          }
        }).pipe(Effect.orDie),
    }
  }),
)
