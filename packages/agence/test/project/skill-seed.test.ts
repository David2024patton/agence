import { describe, expect, test } from "bun:test"
import { CURATED_SKILL_INSTALLS } from "@/project/skill-seed"

describe("CURATED_SKILL_INSTALLS", () => {
  test("uses unique keys and stable repo ids", () => {
    const keys = CURATED_SKILL_INSTALLS.map((item) => item.key)
    expect(new Set(keys).size).toBe(keys.length)

    const anthropic = CURATED_SKILL_INSTALLS.filter((item) => item.github.includes("anthropics/skills"))
    expect(anthropic.every((item) => item.id === "anthropics-skills")).toBe(true)

    const kostja = CURATED_SKILL_INSTALLS.filter((item) => item.github.includes("kostja94/marketing-skills"))
    expect(kostja.every((item) => item.id === "kostja94-marketing-skills")).toBe(true)
  })

  test("includes website builder and SEO sources", () => {
    const labels = CURATED_SKILL_INSTALLS.map((item) => item.label).join(" ")
    expect(labels).toMatch(/web artifacts/i)
    expect(labels).toMatch(/SEO/i)
    expect(labels).toMatch(/landing/i)
  })
})
