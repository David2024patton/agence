import path from "path"
import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { AppFileSystem } from "@agence-ai/core/filesystem"
import { resolveMcpServeMode } from "../../src/mcp/serve"
import { registerProject, listKnownProjects } from "../../src/project/projects-index"
import { ProjectManifest } from "../../src/project/manifest"

describe("projects index", () => {
  test("registerProject adds directory to index", async () => {
    const dir = `${process.cwd()}/.tmp-projects-index-${Date.now()}`
    await Bun.write(`${dir}/.gitkeep`, "")
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* ProjectManifest.ensureManifest(dir)
        yield* registerProject(dir, "Test Project")
        const list = listKnownProjects()
        expect(list.some((item) => item.directory.replace(/\\/g, "/").endsWith(dir.split("/").pop()!))).toBe(true)
      }).pipe(Effect.provide(AppFileSystem.defaultLayer)),
    )
  })

  test("resolveMcpServeMode picks project when manifest exists", async () => {
    const dir = `${process.cwd()}/.tmp-mcp-mode-${Date.now()}`
    await Bun.write(`${dir}/.gitkeep`, "")
    await Effect.runPromise(ProjectManifest.ensureManifest(dir).pipe(Effect.provide(AppFileSystem.defaultLayer)))
    const mode = resolveMcpServeMode({ directory: dir })
    expect(mode.mode).toBe("project")
    if (mode.mode === "project") expect(mode.directory).toBe(path.resolve(dir))
  })
})
