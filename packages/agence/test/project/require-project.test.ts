import path from "path"
import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { AppFileSystem } from "@agence-ai/core/filesystem"
import { Config } from "../../src/config/config"
import { assertProjectDirectory, NotAgenceProjectError } from "../../src/project/require-project"

function run<A, E>(effect: Effect.Effect<A, E, AppFileSystem.Service | Config.Service>) {
  return Effect.runPromise(
    effect.pipe(Effect.provide(AppFileSystem.defaultLayer), Effect.provide(Config.defaultLayer)),
  )
}

describe("require-project", () => {
  test("rejects empty directory", async () => {
    const error = await run(assertProjectDirectory("").pipe(Effect.flip))
    expect(error).toBeInstanceOf(NotAgenceProjectError)
    if (error instanceof NotAgenceProjectError) {
      expect(error._tag).toBe("NotAgenceProjectError")
    }
  })

  test("allows missing path (failsafe) without scaffolding", async () => {
    const dir = `${process.cwd()}/.tmp-missing-project-${Date.now()}`
    const normalized = await run(assertProjectDirectory(dir))
    expect(normalized).toBe(path.resolve(dir))
    const exists = await Bun.file(`${dir}/.agence/project.json`).exists()
    expect(exists).toBe(false)
  })

  test("scaffolds .agence for a new folder", async () => {
    const dir = `${process.cwd()}/.tmp-require-project-${Date.now()}`
    await Bun.write(`${dir}/.gitkeep`, "")
    const normalized = await run(assertProjectDirectory(dir))
    expect(normalized).toBe(path.resolve(dir))
    const exists = await Bun.file(`${dir}/.agence/project.json`).exists()
    expect(exists).toBe(true)
  })
})
