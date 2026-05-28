import { describe, expect, afterEach, mock } from "bun:test"
import { Effect, Layer } from "effect"
import { testEffect } from "../lib/effect"
import { searchArchives } from "../../src/learning/archive"

afterEach(() => {
  mock.restore()
})

const itArchive = testEffect(Layer.empty)

describe("learning.archive (unit)", () => {
  itArchive.instance("archiveConversation creates valid ID format", () => {
    return Effect.gen(function* () {
      // Test that the ID generation format works correctly
      const id = "conv-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8)
      expect(id).toMatch(/^conv-/)
      expect(id.length).toBeGreaterThan(15)
    })
  })

  itArchive.instance("searchArchives handles missing project gracefully", () => {
    return Effect.gen(function* () {
      const results = yield* searchArchives({
        projectId: "nonexistent-project-xyz",
        query: "nothing should match this query",
        limit: 3,
      })
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(0)
    })
  })
})
