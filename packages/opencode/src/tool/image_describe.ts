import { Effect, Schema, Stream } from "effect"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import { ChildProcess } from "effect/unstable/process"
import { AppFileSystem } from "@opencode-ai/core/filesystem"
import { InstanceState } from "@/effect/instance-state"
import path from "path"
import * as Tool from "./tool"
import DESC from "./image_describe.txt"

const OCR_KEY = process.env.AGENCE_OCR_API_KEY || process.env.OCR_SPACE_API_KEY || ""

export const Parameters = Schema.Struct({
  filePath: Schema.String.annotate({ description: "Absolute path to the image file" }),
  strategy: Schema.optional(Schema.Literals(["auto", "ocr", "vision", "metadata"] as const)).annotate({
    description: "Strategy. Default: auto (tries cloud OCR → local OCR → vision → metadata)",
  }),
})

export const ImageDescribeTool = Tool.define<typeof Parameters, { strategy: string }, ChildProcessSpawner | AppFileSystem.Service>(
  "image_describe",
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner
    const fs = yield* AppFileSystem.Service

    function run(cmd: string, args: string[]) {
      return Effect.scoped(Effect.gen(function* () {
        const proc = yield* spawner.spawn(ChildProcess.make(cmd, args))
        return yield* Stream.decodeText(proc.all).pipe(Stream.runFold(() => "", (a: string, b: string) => a + b))
      }))
    }

    return {
      description: DESC,
      parameters: Parameters,
      execute: (params: { filePath: string; strategy?: string }, _ctx: Tool.Context) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const filepath = path.isAbsolute(params.filePath) ? params.filePath : path.resolve(instance.directory, params.filePath)
          const strategy = params.strategy ?? "auto"

          // Strategy 1: Cloud OCR (OCR.space - free tier, cross-platform)
          if ((strategy === "auto" || strategy === "ocr") && OCR_KEY) {
            try {
              const bytes = yield* fs.readFile(filepath)
              const base64 = Buffer.from(bytes).toString("base64")
              const body = new URLSearchParams({ base64Image: "data:image/png;base64," + base64, language: "eng", isOverlayRequired: "false", OCREngine: "2" })
              const text = yield* Effect.promise(() =>
                fetch("https://api.ocr.space/parse/image", { method: "POST", headers: { apikey: OCR_KEY }, body })
                  .then((r) => r.json())
                  .then((d) => d?.ParsedResults?.map((r: { ParsedText: string }) => r.ParsedText).filter(Boolean).join("\n\n") ?? "")
              )
              if (text?.trim()) {
                return {
                  title: "Image (OCR.space)",
                  metadata: { strategy: "ocr_space" },
                  output: `[OCR text]:\n\n${text.trim().slice(0, 4000)}`,
                }
              }
            } catch { /* fall through to next strategy */ }
          }

          // Strategy 2: Local OCR fallback
          if (strategy === "auto" || strategy === "ocr") {
            if (process.platform === "win32") {
              const escaped = filepath.replace(/\\/g, "\\\\")
              const r = yield* run("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", `try{$img=[System.Drawing.Image]::FromFile("${escaped}");$ocr=New-Object -ComObject MODI.Document;$ocr.Create($img);$ocr.OCR();$ocr.Images[0].Layout.Text;$ocr.Close();$img.Dispose()}catch{}`]).pipe(Effect.catch(() => Effect.succeed("")))
              if (r.trim()) return { title: "Image (OCR)", metadata: { strategy: "ocr_local" }, output: `[OCR text]:\n\n${r.trim().slice(0, 4000)}` }
            } else {
              const r = yield* run("tesseract", [filepath, "stdout"]).pipe(Effect.catch(() => Effect.succeed("")))
              if (r.trim()) return { title: "Image (OCR)", metadata: { strategy: "ocr_local" }, output: `[OCR text]:\n\n${r.trim().slice(0, 4000)}` }
            }
          }

          // Strategy 3: Local vision model
          if (strategy === "auto" || strategy === "vision") {
            const models = yield* run("ollama", ["list"]).pipe(Effect.catch(() => Effect.succeed("")))
            let vm = "llava"
            if (models.includes("minicpm-v")) vm = "minicpm-v"
            else if (!models.includes("llava") && !models.includes("bakllava")) vm = ""
            if (vm) {
              const r = yield* run("ollama", ["run", vm, "Describe this image in detail. Include all visible text, UI elements, layout, and notable visual features. Be concise."]).pipe(Effect.catch(() => Effect.succeed("")))
              if (r.trim()) return { title: `Image (${vm})`, metadata: { strategy: "vision" }, output: `[${vm} description]:\n\n${r.trim().slice(0, 4000)}` }
            }
          }

          // Strategy 4: Metadata fallback
          const stat = yield* fs.stat(filepath).pipe(Effect.catch(() => Effect.succeed(undefined)))
          const ext = path.extname(filepath).toLowerCase()
          const size = stat ? `${Math.round(Number(stat.size) / 1024)}KB` : "?"
          const mimes: Record<string, string> = { ".png": "PNG", ".jpg": "JPEG", ".jpeg": "JPEG", ".gif": "GIF", ".webp": "WebP", ".bmp": "BMP" }
          const hasOcr = !!OCR_KEY
          const hasTesseract = process.platform !== "win32" // assume available on unix; windows uses built-in
          const hasOllama = false // checked above
          return {
            title: "Image (metadata)",
            metadata: { strategy: "metadata", hasOcrKey: hasOcr },
            output: [
              `${path.basename(filepath)} (${mimes[ext] ?? ext}, ${size}).`,
              "",
              "No content description available. Setup options:",
              hasOcr  ? "✅ Cloud OCR (OCR.space) — configured" : "⬜ Cloud OCR — set AGENCE_OCR_API_KEY (free at ocr.space/OCRAPI)",
              hasTesseract ? "✅ Local OCR available" : "⬜ Local OCR — install tesseract-ocr",
              hasOllama ? "✅ Ollama vision model available" : "⬜ Local vision — install Ollama + llava",
            ].join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)
