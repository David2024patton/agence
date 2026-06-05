import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { AppFileSystem } from "@agence-ai/core/filesystem"
import { SessionGoal } from "../../src/session/goal"
import { ProjectManifest } from "../../src/project/manifest"

describe("project goal", () => {
  test("parseGoalArgs handles lifecycle subcommands", () => {
    expect(SessionGoal.parseGoalArgs("").type).toBe("show")
    expect(SessionGoal.parseGoalArgs("pause").type).toBe("pause")
    expect(SessionGoal.parseGoalArgs("resume").type).toBe("resume")
    expect(SessionGoal.parseGoalArgs("clear").type).toBe("clear")
    expect(SessionGoal.parseGoalArgs("Reduce p95 below 120ms").type).toBe("set")
  })

  test("syncFromManifest activates goal when project.json has goal", async () => {
    const dir = `${process.cwd()}/.tmp-goal-${Date.now()}`
    await Bun.write(`${dir}/.gitkeep`, "")

    await Effect.runPromise(
      Effect.gen(function* () {
        yield* ProjectManifest.saveManifest(dir, {
          goal: "Fix flaky checkout test with evidence",
          enabled_groups: ["default"],
        })
        const synced = yield* SessionGoal.syncFromManifest(dir, dir)
        expect(synced?.status).toBe("active")
        expect(synced?.objective).toContain("flaky checkout")

        const loaded = yield* SessionGoal.loadGoal(dir)
        expect(loaded?.objective).toContain("flaky checkout")
      }).pipe(Effect.provide(AppFileSystem.defaultLayer)),
    )
  })

  test("applyAction set writes manifest and goal.json", async () => {
    const dir = `${process.cwd()}/.tmp-goal-set-${Date.now()}`
    await Bun.write(`${dir}/.gitkeep`, "")

    await Effect.runPromise(
      Effect.gen(function* () {
        yield* ProjectManifest.ensureManifest(dir)
        const set = yield* SessionGoal.applyAction({
          directory: dir,
          worktree: dir,
          action: { type: "set", objective: "Ship hub goal sync" },
        })
        expect(set.startWork).toBe(true)

        const manifest = yield* ProjectManifest.loadManifest(dir)
        expect(manifest.goal).toBe("Ship hub goal sync")

        const loaded = yield* SessionGoal.loadGoal(dir)
        expect(loaded?.status).toBe("active")
      }).pipe(Effect.provide(AppFileSystem.defaultLayer)),
    )
  })
})
