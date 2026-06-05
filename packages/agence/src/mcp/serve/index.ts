import { existsSync } from "fs"
import path from "path"
import { Effect } from "effect"
import { manifestPath } from "@/project/manifest"
import { runGlobalMcpServe } from "./global"
import { runProjectMcpServe } from "./project"

export function resolveMcpServeMode(input: { directory?: string; global?: boolean }) {
  if (input.global) return { mode: "global" as const }
  const directory = input.directory ? path.resolve(input.directory) : path.resolve(process.cwd())
  if (existsSync(manifestPath(directory)) || existsSync(path.join(directory, ".agence"))) {
    return { mode: "project" as const, directory }
  }
  if (input.directory) return { mode: "project" as const, directory }
  return { mode: "global" as const }
}

export function runMcpServe(input: { directory?: string; global?: boolean }) {
  const resolved = resolveMcpServeMode(input)
  if (resolved.mode === "global") return runGlobalMcpServe()
  return runProjectMcpServe(resolved.directory)
}

export * as McpServe from "./index"
