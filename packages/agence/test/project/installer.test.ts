import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { AppFileSystem } from "@agence-ai/core/filesystem"
import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { parseGithub, normalizeInstalledSkills, installFromGithub, SkillInstallError } from "../../src/project/installer"
import { tmpdir } from "../fixture/fixture"

describe("parseGithub", () => {
  test("parses owner/repo shorthand", () => {
    expect(parseGithub("David2024patton/agence")).toEqual({
      owner: "David2024patton",
      repo: "agence",
      branch: undefined,
      subpath: undefined,
    })
  })

  test("parses https repo URLs", () => {
    expect(parseGithub("https://github.com/owner/repo.git")).toEqual({
      owner: "owner",
      repo: "repo",
      branch: undefined,
      subpath: undefined,
    })
  })

  test("parses tree URLs with subpath and branch", () => {
    expect(parseGithub("https://github.com/owner/repo/tree/main/skills/demo")).toEqual({
      owner: "owner",
      repo: "repo",
      branch: "main",
      subpath: "skills/demo",
    })
  })

  test("parses owner/repo/subpath shorthand", () => {
    expect(parseGithub("owner/repo/.opencode/skills/demo")).toEqual({
      owner: "owner",
      repo: "repo",
      branch: undefined,
      subpath: ".opencode/skills/demo",
    })
  })
})

describe("normalizeInstalledSkills", () => {
  test("copies each skill folder to .agence/installs/{name}/", async () => {
    await using tmp = await tmpdir({ git: false })
    const repoRoot = path.join(tmp.path, "fake-repo", ".opencode", "skills", "demo-skill")
    await mkdir(repoRoot, { recursive: true })
    await writeFile(
      path.join(repoRoot, "SKILL.md"),
      `---
name: demo-skill
description: Demo skill for tests
---

# Demo
`,
    )
    await writeFile(path.join(repoRoot, "notes.md"), "extra file")

    const names = await Effect.runPromise(
      normalizeInstalledSkills(tmp.path, path.join(tmp.path, "fake-repo")).pipe(
        Effect.provide(AppFileSystem.defaultLayer),
      ),
    )

    expect(names).toEqual(["demo-skill"])
    const installed = path.join(tmp.path, ".agence", "installs", "demo-skill", "SKILL.md")
    expect(await Bun.file(installed).text()).toContain("Demo skill for tests")
    expect(await Bun.file(path.join(tmp.path, ".agence", "installs", "demo-skill", "notes.md")).exists()).toBe(true)
  })
})

describe("installFromGithub skill errors", () => {
  test("rejects invalid github ref", async () => {
    await using tmp = await tmpdir({ git: false })
    const error = await Effect.runPromise(
      installFromGithub(tmp.path, { type: "skill", github: "not-a-valid-ref" }).pipe(
        Effect.provide(AppFileSystem.defaultLayer),
        Effect.flip,
      ),
    )
    expect(error).toBeInstanceOf(SkillInstallError)
    if (error instanceof SkillInstallError) {
      expect(error._tag).toBe("SkillInstallError")
      expect(error.message).toContain("Invalid GitHub ref")
    }
  })

  test("rejects clone with no valid SKILL.md", async () => {
    await using tmp = await tmpdir({ git: false })
    const cloneRoot = path.join(tmp.path, ".agence", "installs", "acme-empty-repo")
    await mkdir(cloneRoot, { recursive: true })
    await writeFile(path.join(cloneRoot, "README.md"), "# empty")

    const error = await Effect.runPromise(
      installFromGithub(tmp.path, { type: "skill", github: "acme/empty-repo" }).pipe(
        Effect.provide(AppFileSystem.defaultLayer),
        Effect.flip,
      ),
    )
    expect(error).toBeInstanceOf(SkillInstallError)
    if (error instanceof SkillInstallError) {
      expect(error._tag).toBe("SkillInstallError")
      expect(error.message).toContain("No valid SKILL.md")
    }
  })

  test("rejects unsupported install types", async () => {
    await using tmp = await tmpdir({ git: false })
    const error = await Effect.runPromise(
      installFromGithub(tmp.path, { type: "document_pack", github: "owner/repo" }).pipe(
        Effect.provide(AppFileSystem.defaultLayer),
        Effect.flip,
      ),
    )
    expect(error).toBeInstanceOf(SkillInstallError)
    if (error instanceof SkillInstallError) {
      expect(error._tag).toBe("SkillInstallError")
      expect(error.message).toContain("not supported")
    }
  })

  test("rejects subpath traversal", async () => {
    await using tmp = await tmpdir({ git: false })
    const cloneRoot = path.join(tmp.path, ".agence", "installs", "acme-repo")
    await mkdir(cloneRoot, { recursive: true })
    await writeFile(path.join(cloneRoot, "README.md"), "# ok")
    const error = await Effect.runPromise(
      installFromGithub(tmp.path, { type: "skill", github: "acme/repo", subpath: ".." }).pipe(
        Effect.provide(AppFileSystem.defaultLayer),
        Effect.flip,
      ),
    )
    expect(error).toBeInstanceOf(SkillInstallError)
    if (error instanceof SkillInstallError) {
      expect(error._tag).toBe("SkillInstallError")
      expect(error.message).toContain("escapes")
    }
  })
})
