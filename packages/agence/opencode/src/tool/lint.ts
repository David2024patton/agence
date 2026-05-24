import { Effect, Schema, Stream } from "effect"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import { ChildProcess } from "effect/unstable/process"
import { InstanceState } from "@/effect/instance-state"
import path from "path"
import * as Tool from "./tool"
import DESCRIPTION from "./lint.txt"

const LANG_DETECT: Record<string, string> = {
  ".ts": "typescript", ".tsx": "typescript", ".js": "javascript", ".jsx": "javascript",
  ".py": "python", ".rs": "rust", ".md": "markdown",
}

export const Parameters = Schema.Struct({
  path: Schema.optional(Schema.String).annotate({
    description: "File or directory path to lint. Omit for entire project.",
  }),
  language: Schema.optional(Schema.String).annotate({
    description: "Language to lint (ts, js, py, rs, etc). Auto-detected by file extension if omitted.",
  }),
})

export const LintTool = Tool.define(
  "lint",
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: { path?: string; language?: string }, _ctx: Tool.Context) =>
        Effect.scoped(
          Effect.gen(function* () {
            const instance = yield* InstanceState.context
            const target = params.path
              ? (path.isAbsolute(params.path) ? params.path : path.resolve(instance.directory, params.path))
              : instance.directory
            const ext = path.extname(target).toLowerCase()
            const lang = params.language ?? (LANG_DETECT[ext] ?? "auto")

            let command: string[]
            switch (lang) {
              case "typescript":
                command = ["npx", "tsc", "--noEmit", "--pretty", "false"]
                break
              case "python":
                command = ["ruff", "check", target]
                break
              case "rust":
                command = ["cargo", "clippy", "--message-format", "short"]
                break
              case "markdown":
                command = ["npx", "markdownlint", target]
                break
              default:
                return {
                  title: "Lint",
                  metadata: {} as Record<string, unknown>,
                  output: `No linter configured for language: ${lang}. Supported: typescript, python, rust, markdown.`,
                }
            }

            const isWin = process.platform === "win32"
            const proc = yield* spawner.spawn(
              isWin
                ? ChildProcess.make("cmd.exe", ["/c", ...command], { cwd: instance.directory })
                : ChildProcess.make(command[0], command.slice(1), { cwd: instance.directory }),
            )
            const raw = yield* Stream.decodeText(proc.all).pipe(
              Stream.runFold(() => "", (a: string, b: string) => a + b),
            )
            const output = String(raw)
            return {
              title: `Lint: ${lang}`,
              metadata: { language: lang, path: target } as Record<string, unknown>,
              output: output ? output.slice(0, 8000) : "No lint errors found.",
            }
          }),
        ).pipe(Effect.orDie),
    }
  }),
)
