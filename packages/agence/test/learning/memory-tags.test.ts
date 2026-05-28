import { describe, expect, test } from "bun:test"
import { inferMemoryTags, mergeMemoryTags, tagMatchBoost } from "../../src/learning/memory-tags"

describe("memory-tags", () => {
  test("inferMemoryTags detects UI and workflow from text", () => {
    const tags = inferMemoryTags({
      layer: "preference",
      description: "Always use Tailwind for UI components in this workflow",
    })
    expect(tags).toContain("UI")
    expect(tags).toContain("workflow")
    expect(tags).toContain("preference")
  })

  test("mergeMemoryTags keeps explicit and inferred", () => {
    expect(mergeMemoryTags(["custom"], ["UI", "tools"])).toEqual(["custom", "UI", "tools"])
  })

  test("tagMatchBoost increases score when query matches tags", () => {
    expect(tagMatchBoost("UI layout workflow", ["UI", "workflow"])).toBeGreaterThan(1)
    expect(tagMatchBoost("unrelated query", ["database"])).toBe(1)
  })
})
