import { describe, expect, test } from "bun:test"
import path from "path"
import { Permission } from "@/permission"
import { ChatMode } from "@/session/chat-mode"

const ctx = {
  directory: "/proj",
  worktree: "/proj",
  project: { vcs: "git" as const },
} as Parameters<typeof ChatMode.permissions>[1]["ctx"]

const session = {
  slug: "test-session",
  time: { created: 1_700_000_000_000 },
} as Parameters<typeof ChatMode.permissions>[1]["session"]

describe("ChatMode.permissions", () => {
  test("build mode adds no rules", () => {
    expect(ChatMode.permissions("build", { session, ctx })).toEqual([])
    expect(ChatMode.permissions(undefined, { session, ctx })).toEqual([])
  })

  test("plan mode denies bash and allows only plan markdown paths", () => {
    const rules = ChatMode.permissions("plan", { session, ctx })
    expect(Permission.evaluate("bash", "*", rules).action).toBe("deny")
    expect(Permission.evaluate("edit", "src/index.ts", rules).action).toBe("deny")
    expect(Permission.evaluate("edit", ".opencode/plans/foo.md", rules).action).toBe("allow")
    expect(Permission.evaluate("edit", path.join(".opencode", "plans", "foo.md"), rules).action).toBe("allow")
  })

  test("research mode allows reports under wiki research", () => {
    const rules = ChatMode.permissions("research", { session, ctx })
    expect(Permission.evaluate("bash", "*", rules).action).toBe("deny")
    expect(Permission.evaluate("edit", "packages/agence/src/index.ts", rules).action).toBe("deny")
    expect(Permission.evaluate("edit", ".agence/knowledge/wiki/research/2026-05-28-topic.md", rules).action).toBe(
      "allow",
    )
    expect(Permission.evaluate("edit", ".agence/knowledge/reports/summary.md", rules).action).toBe("allow")
  })

  test("research mode does not block web search", () => {
    const rules = ChatMode.permissions("research", { session, ctx })
    expect(Permission.evaluate("websearch", "*", rules).action).not.toBe("deny")
    expect(Permission.evaluate("webfetch", "*", rules).action).not.toBe("deny")
  })
})

describe("ChatMode.syntheticReminder", () => {
  test("returns instructions for plan and research", () => {
    expect(ChatMode.syntheticReminder("build", { session, ctx })).toBeUndefined()
    expect(ChatMode.syntheticReminder("plan", { session, ctx })).toContain("Plan chat mode")
    const research = ChatMode.syntheticReminder("research", { session, ctx })
    expect(research).toContain("Deep research")
    expect(research).toContain(".agence/knowledge/wiki/research")
    expect(research).toContain("Required deliverable")
  })
})

describe("ChatMode.toolDescription", () => {
  test("write tool gets research addendum that overrides no-docs rule", () => {
    const base = "NEVER proactively create documentation files."
    const next = ChatMode.toolDescription("write", "research", { session, ctx }, base)
    expect(next).toContain("NEVER proactively create documentation")
    expect(next).toContain("does **not** apply")
    expect(next).toContain(`${session.slug}.md`)
  })
})
