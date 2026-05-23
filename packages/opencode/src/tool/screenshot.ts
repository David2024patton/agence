import { Effect, Schema, Stream } from "effect"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import { ChildProcess } from "effect/unstable/process"
import { AppFileSystem } from "@opencode-ai/core/filesystem"
import os from "os"
import path from "path"
import crypto from "crypto"
import * as Tool from "./tool"
import DESCRIPTION from "./screenshot.txt"

export const Parameters = Schema.Struct({})

export const ScreenshotTool = Tool.define(
  "screenshot",
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner
    const fs = yield* AppFileSystem.Service

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (_params: {}, _ctx: Tool.Context) =>
        Effect.scoped(
          Effect.gen(function* () {
            const tmpDir = os.tmpdir()
            const filename = `screenshot-${crypto.randomBytes(4).toString("hex")}.png`
            const filepath = path.join(tmpDir, filename)
            const escapedPath = filepath.replace(/\\/g, "\\\\")

            if (process.platform === "win32") {
              const psScript = `Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $screen=[System.Windows.Forms.SystemInformation]::VirtualScreen; $bmp=New-Object System.Drawing.Bitmap($screen.Width,$screen.Height); $g=[System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($screen.Left,$screen.Top,0,0,$bmp.Size); $bmp.Save('${escapedPath}'); $g.Dispose(); $bmp.Dispose()`
              const proc = yield* spawner.spawn(
                ChildProcess.make("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", psScript]),
              )
              yield* Stream.decodeText(proc.all).pipe(Stream.runDrain)
            } else if (process.platform === "darwin") {
              const proc = yield* spawner.spawn(
                ChildProcess.make("screencapture", ["-x", filepath]),
              )
              yield* Stream.decodeText(proc.all).pipe(Stream.runDrain)
            } else {
              const proc = yield* spawner.spawn(
                ChildProcess.make("gnome-screenshot", ["-f", filepath]),
              )
              yield* Stream.decodeText(proc.all).pipe(Stream.runDrain)
            }

            const exists = yield* fs.existsSafe(filepath)
            if (!exists) {
              return {
                title: "Screenshot",
                metadata: {} as Record<string, unknown>,
                output: "Screenshot failed: no output file produced.",
                attachments: undefined,
              }
            }

            const bytes = yield* fs.readFile(filepath)
            const base64 = Buffer.from(bytes).toString("base64")
            return {
              title: "Screenshot",
              metadata: { filepath } as Record<string, unknown>,
              output: "Screenshot captured successfully.",
              attachments: [{
                type: "file" as const,
                mime: "image/png",
                url: `data:image/png;base64,${base64}`,
              }],
            }
          }),
        ).pipe(Effect.orDie),
    }
  }),
)
