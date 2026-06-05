import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import path from "path"
import { ensureProjectWikiSync } from "@/learning/wiki-seed"
import { listWikiArticlesForProject } from "@/learning/wiki"

describe("listWikiArticlesForProject", () => {
  test("returns empty files when wiki directory does not exist", async () => {
    const dir = path.join(import.meta.dir, ".tmp-missing-wiki-" + Date.now())
    const result = await Effect.runPromise(listWikiArticlesForProject(dir))
    expect(result.files).toEqual([])
    expect(result.path).toContain(".agence/knowledge/wiki")
  })

  test("ensureProjectWiki seeds bundled articles", async () => {
    const dir = path.join(import.meta.dir, ".tmp-wiki-seed-" + Date.now())
    const seeded = await ensureProjectWikiSync(dir)
    expect(seeded.articleCount).toBeGreaterThan(0)
    const result = await Effect.runPromise(listWikiArticlesForProject(dir))
    expect(result.files.length).toBeGreaterThan(0)
    expect(result.files.some((file) => file.name === "agence-overview.md")).toBe(true)
    expect(result.files.some((file) => file.name === "seo-basics.md")).toBe(true)
    expect(result.files.some((file) => file.name === "web-design-fundamentals.md")).toBe(true)
    expect(result.files.some((file) => file.name === "index.md")).toBe(true)
  })
})
