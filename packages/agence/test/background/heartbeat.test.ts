import { describe, expect, it } from "bun:test"
import { parseHeartbeatTasks } from "../../src/background/heartbeat"

describe("Heartbeat Parser", () => {
  it("should parse heartbeat checklist tasks correctly", () => {
    const markdown = `
# Heartbeat Tasks
- [ ] Every 30m: check-inbox | check for new messages and respond to them
- [x] Every 1h: codebase-sync | sync codebase changes and generate wiki
- [ ] Every 12h: backup-db | run background backup tasks
- [ ] Every 1d: daily-reflection | consolidate learnings
- [ ] every 15m: fast-check | quick check
`
    const tasks = parseHeartbeatTasks(markdown)
    expect(tasks.length).toBe(5)

    expect(tasks[0].enabled).toBe(true)
    expect(tasks[1].enabled).toBe(false)
    expect(tasks[0].interval).toBe("30m")
    expect(tasks[0].taskName).toBe("check-inbox")
    expect(tasks[0].prompt).toBe("check for new messages and respond to them")
    expect(tasks[0].intervalMs).toBe(30 * 60 * 1000)

    expect(tasks[1].interval).toBe("1h")
    expect(tasks[1].taskName).toBe("codebase-sync")
    expect(tasks[1].prompt).toBe("sync codebase changes and generate wiki")
    expect(tasks[1].intervalMs).toBe(60 * 60 * 1000)

    expect(tasks[2].interval).toBe("12h")
    expect(tasks[2].taskName).toBe("backup-db")
    expect(tasks[2].intervalMs).toBe(12 * 60 * 60 * 1000)

    expect(tasks[3].interval).toBe("1d")
    expect(tasks[3].taskName).toBe("daily-reflection")
    expect(tasks[3].intervalMs).toBe(24 * 60 * 60 * 1000)

    expect(tasks[4].interval).toBe("15m")
    expect(tasks[4].taskName).toBe("fast-check")
    expect(tasks[4].intervalMs).toBe(15 * 60 * 1000)
  })

  it("supports cmd: and fn: prompts without changing parsing", () => {
    const markdown = `
- [ ] Every 30m: export-mem | fn:memory-export
- [ ] Every 1h: prune-mem | fn:memory-maintenance
- [ ] Every 12h: backup | cmd: bun run scripts/backup.ts
`
    const tasks = parseHeartbeatTasks(markdown)
    expect(tasks.length).toBe(3)
    expect(tasks[0].prompt).toBe("fn:memory-export")
    expect(tasks[1].prompt).toBe("fn:memory-maintenance")
    expect(tasks[2].prompt).toBe("cmd: bun run scripts/backup.ts")
  })

  it("should ignore invalid lines", () => {
    const markdown = `
- Every 30m: invalid-no-checkbox | fails
- [ ] Every 30: invalid-no-unit | fails
- [ ] Every 30m invalid-no-separator | fails
- [ ] invalid-format
`
    const tasks = parseHeartbeatTasks(markdown)
    expect(tasks.length).toBe(0)
  })
})
