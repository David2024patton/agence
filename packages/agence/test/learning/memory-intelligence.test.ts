import { describe, expect, test } from "bun:test"
import { detectAutoMemories, computeDecayScore } from "../../src/learning/memory-intelligence"
import type { Learning } from "../../src/learning"

describe("memory-intelligence", () => {
  test("detectAutoMemories finds preferences and corrections", () => {
    const memories = detectAutoMemories([
      {
        info: { role: "user" },
        parts: [{ type: "text", text: "Always use bun, never npm in this repo" }],
      },
      {
        info: { role: "user" },
        parts: [{ type: "text", text: "No, that's wrong — use Effect.catch not catchAll" }],
      },
      {
        info: { role: "assistant" },
        parts: [{ type: "tool", tool: "shell", state: "error", error: "Command failed: ENOENT" }],
      },
    ])

    expect(memories.some((m) => m.layer === "preference")).toBe(true)
    expect(memories.some((m) => m.layer === "experience")).toBe(true)
    expect(memories.some((m) => m.layer === "activity")).toBe(true)
  })

  test("computeDecayScore ranks critical above stale low-value auto memories", () => {
    const now = Date.now()
    const critical: Learning = {
      id: "a",
      projectId: "p",
      source: "experience",
      concept: "arch",
      description: "critical",
      confidence: "high",
      metadata: { importance: "critical", accessCount: 5 },
      timeCreated: now - 1_000,
    }
    const stale: Learning = {
      id: "b",
      projectId: "p",
      source: "activity",
      concept: "noise",
      description: "low",
      confidence: "low",
      metadata: { importance: "low", autoCapture: true, accessCount: 0 },
      timeCreated: now - 1000 * 60 * 60 * 24 * 60,
    }

    expect(computeDecayScore(critical, now)).toBeGreaterThan(computeDecayScore(stale, now))
  })
})
