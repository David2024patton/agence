import { Effect, Schema } from "effect"
import os from "os"
import * as Tool from "./tool"
import DESCRIPTION from "./system_info.txt"

export const Parameters = Schema.Struct({})

export const SystemInfoTool = Tool.define(
  "system_info",
  Effect.gen(function* () {
    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (_params: {}, _ctx: Tool.Context) =>
        Effect.sync(() => {
          const cpus = os.cpus()
          const info = {
            platform: process.platform,
            arch: process.arch,
            hostname: os.hostname(),
            os: os.type() + " " + os.release(),
            cpus: cpus.length + " cores (" + (cpus[0]?.model ?? "unknown") + ")",
            memory: (os.totalmem() / (1024 * 1024 * 1024)).toFixed(1) + " GB total, " +
              (os.freemem() / (1024 * 1024 * 1024)).toFixed(1) + " GB free",
            uptime: Math.floor(os.uptime()) + " seconds",
            homedir: os.homedir(),
            nodeVersion: process.version,
            pid: process.pid,
          }
          return {
            title: "System Information",
            metadata: info,
            output: Object.entries(info)
              .map(([key, value]) => `${key}: ${value}`)
              .join("\n"),
          }
        }),
    }
  }),
)
