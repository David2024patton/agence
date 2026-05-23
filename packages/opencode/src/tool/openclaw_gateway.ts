import { Effect, Schema, Stream } from "effect"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import { ChildProcess } from "effect/unstable/process"
import { AppFileSystem } from "@opencode-ai/core/filesystem"
import { InstanceState } from "@/effect/instance-state"
import path from "path"
import * as Tool from "./tool"
import DESC from "./openclaw_gateway.txt"

const OPENCLAW_BIN = process.env.AGENCE_OPENCLAW_BIN || "openclaw"

export const GatewayInitParameters = Schema.Struct({
  telegramToken: Schema.optional(Schema.String).annotate({ description: "Telegram bot token from @BotFather (get one at t.me/BotFather)" }),
  discordToken: Schema.optional(Schema.String).annotate({ description: "Discord bot token" }),
})

export const OpenClawGatewayTool = Tool.define<typeof GatewayInitParameters, {}, ChildProcessSpawner | AppFileSystem.Service>(
  "openclaw_gateway",
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner
    const fs = yield* AppFileSystem.Service

    function run(args: string[]) {
      return Effect.scoped(
        Effect.gen(function* () {
          const proc = yield* spawner.spawn(ChildProcess.make(OPENCLAW_BIN, args))
          return yield* Stream.decodeText(proc.all).pipe(Stream.runFold(() => "", (a: string, b: string) => a + b))
        }),
      )
    }

    return {
      description: DESC,
      parameters: GatewayInitParameters,
      execute: (params: { telegramToken?: string; discordToken?: string }, _ctx: Tool.Context) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const gwDir = path.join(instance.directory, ".agence", "gateway")
          const configFile = path.join(gwDir, "config.json")

          // Check if openclaw is installed
          const versionCheck = yield* run(["--version"]).pipe(Effect.catch(() => Effect.succeed("")))
          if (!versionCheck) {
            return {
              title: "Gateway: Not Installed",
              metadata: {},
              output: "OpenClaw is not installed. Run: npm install -g openclaw",
            }
          }

          // Build config
          const config: Record<string, unknown> = {
            agent: { provider: "local", endpoint: "http://127.0.0.1:60260" },
            channels: {} as Record<string, unknown>,
          }
          const channels: Record<string, unknown> = {}
          if (params.telegramToken) channels["telegram"] = { token: params.telegramToken }
          if (params.discordToken) channels["discord"] = { token: params.discordToken }
          config.channels = channels

          yield* fs.writeWithDirs(configFile, JSON.stringify(config, null, 2))

          // Start gateway
          yield* run(["gateway", "start", "--config", configFile]).pipe(Effect.catch(() => Effect.succeed("")))

          const status = [`OpenClaw gateway started via Agence.`, `Config: ${configFile}`, ""]
          status.push(params.telegramToken ? "✅ Telegram connected" : "⬜ Telegram token not set")
          status.push(params.discordToken ? "✅ Discord connected" : "⬜ Discord token not set")
          status.push("", "Talk to your AI on Telegram/Discord. Messages route through Agence.")

          return { title: "Gateway Active", metadata: {}, output: status.join("\n") }
        }).pipe(Effect.orDie),
    }
  }),
)
