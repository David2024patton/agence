import { describe, expect, test } from "bun:test"
import { applySkillEdits, validateSkillDocument } from "../../src/learning/skill-opt"

const base = `---
name: demo-skill
description: Demo skill
---

# Demo Skill

## Steps

1. Run tests
`

describe("SkillOpt", () => {
  test("applySkillEdits adds a bounded section", () => {
    const result = applySkillEdits(
      base,
      [{ op: "add", section: "Troubleshooting", content: "If tests fail, rerun with verbose logging." }],
      800,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.content).toContain("## Troubleshooting")
    expect(result.content).toContain("verbose logging")
  })

  test("applySkillEdits rejects oversized edit budget", () => {
    const result = applySkillEdits(
      base,
      [{ op: "add", section: "Huge", content: "x".repeat(2000) }],
      100,
    )
    expect(result.ok).toBe(false)
  })

  test("validateSkillDocument accepts well-formed skill", () => {
    expect(validateSkillDocument(base).ok).toBe(true)
  })

  test("validateSkillDocument rejects missing frontmatter", () => {
    expect(validateSkillDocument("# Title only\n\nNo frontmatter here.").ok).toBe(false)
  })
})
