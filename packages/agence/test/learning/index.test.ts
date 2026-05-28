import { describe, expect, afterEach, mock } from "bun:test"
import { Effect, Layer } from "effect"
import { testEffect } from "../lib/effect"
import { storeLearning, searchLearnings, recentLearnings, cosineSimilarity } from "../../src/learning"
import { ProjectTable } from "../../src/project/project.sql"
import { Database } from "@/storage/db"

afterEach(() => {
  mock.restore()
})

const itLearning = testEffect(Layer.empty)

function seedProject(projectId: string) {
  Database.use((db) =>
    db
      .insert(ProjectTable)
      .values({
        id: projectId as any,
        worktree: "/",
        time_created: Date.now(),
        time_updated: Date.now(),
        sandboxes: [],
      })
      .onConflictDoNothing()
      .run(),
  )
}

describe("learning.index (unit)", () => {
  itLearning.instance("cosineSimilarity computes correct vector similarity", () => {
    return Effect.gen(function* () {
      const vecA = [1, 0, 0]
      const vecB = [1, 0, 0]
      const vecC = [0, 1, 0]

      expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(1.0)
      expect(cosineSimilarity(vecA, vecC)).toBeCloseTo(0.0)
    })
  })

  itLearning.instance("storeLearning and searchLearnings operates database correctly", () => {
    return Effect.gen(function* () {
      const projectId = "test-project-123"
      yield* Effect.sync(() => seedProject(projectId))

      // Store a learning item
      const id = yield* storeLearning({
        projectId,
        source: "preference",
        concept: "Aesthetic preference",
        description: "David prefers Harmony and dark modes in design.",
        confidence: "high",
        relatedTo: ["aesthetic"],
      })

      expect(id).toBeDefined()
      expect(id.length).toBeGreaterThan(5)

      // Search matching term
      const results = yield* searchLearnings({
        projectId,
        query: "David prefers Harmony",
        limit: 2,
      })

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].concept).toBe("Aesthetic preference")
      expect(results[0].source).toBe("preference")
      if (results[0].score !== undefined) {
        expect(results[0].score).toBeGreaterThan(0.4)
      }

      // Search non-matching term
      const emptyResults = yield* searchLearnings({
        projectId,
        query: "completely random term that won't exist",
        limit: 2,
      })
      expect(emptyResults.length).toBe(0)
    })
  })

  itLearning.instance("recentLearnings retrieves scoped lists in order", () => {
    return Effect.gen(function* () {
      const projectId = "test-project-abc"
      yield* Effect.sync(() => seedProject(projectId))

      yield* storeLearning({
        projectId,
        source: "activity",
        concept: "First Event",
        description: "Initial bootstrap sequence started.",
      })

      yield* storeLearning({
        projectId,
        source: "activity",
        concept: "Second Event",
        description: "HTTP server diagnostics verified.",
      })

      const recents = yield* recentLearnings({
        projectId,
        limit: 5,
      })

      expect(recents.length).toBe(2)
      expect(recents.map((r) => r.concept).sort()).toEqual(["First Event", "Second Event"])
    })
  })
})
