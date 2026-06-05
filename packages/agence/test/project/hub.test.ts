import { describe, expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import { AppFileSystem } from "@agence-ai/core/filesystem"
import { Config } from "../../src/config/config"
import { ProjectManifest } from "../../src/project/manifest"
import { ProjectRegistry, effectiveRefs, groupFilterSets, refLockedInBuiltinEnabled } from "../../src/project/registry"
import { applyManifestToConfig } from "../../src/project/hub"
import { InstanceStore } from "../../src/project/instance-store"

describe("project hub manifest", () => {
  test("applyManifestToConfig maps persona and model", () => {
    const patch = applyManifestToConfig({
      persona_id: "build",
      default_model: "opencode/mimo-v2-pro-free",
    })
    expect(patch.default_agent).toBe("build")
    expect(patch.model).toBe("opencode/mimo-v2-pro-free")
  })

  test("registry effective refs honor enabled groups", () => {
    const registry = { groups: [{ id: "custom", name: "Custom", items: [{ type: "skill" as const, ref: "demo" }] }] }
    const refs = effectiveRefs({ enabled_groups: ["default", "custom"] }, registry)
    expect(refs.some((ref) => ref.type === "skill" && ref.ref === "agence")).toBe(true)
    expect(refs.some((ref) => ref.ref === "demo")).toBe(true)
  })

  test("group filter sets restrict skills when listed", () => {
    const filter = groupFilterSets({ enabled_groups: ["minimal"] }, { groups: [] })
    expect(filter.skills).toBeUndefined()
    const minimal = groupFilterSets({ enabled_groups: ["default"] }, { groups: [] })
    expect(minimal.skills?.has("agence")).toBe(true)
  })

  test("savePersona writes markdown and registry", async () => {
    const dir = `${process.cwd()}/.tmp-persona-test-${Date.now()}`
    await Bun.write(`${dir}/.gitkeep`, "")
    await Effect.runPromise(
      Effect.gen(function* () {
        const { savePersona, loadPersonaContent } = yield* Effect.promise(() => import("../../src/project/persona"))
        yield* savePersona(dir, {
          name: "PPC Expert",
          description: "Paid ads specialist",
          prompt: "You optimize PPC campaigns and n8n automations.",
          activate: true,
        })
        const loaded = yield* loadPersonaContent(dir, "ppc-expert")
        expect(loaded.name).toBe("PPC Expert")
        expect(loaded.prompt).toContain("PPC campaigns")
        const manifest = yield* ProjectManifest.loadManifest(dir)
        expect(manifest.persona_id).toBe("ppc-expert")
      }).pipe(
        Effect.provide(AppFileSystem.defaultLayer),
        Effect.provide(Config.defaultLayer),
        Effect.provide(
          Layer.succeed(
            InstanceStore.Service,
            InstanceStore.Service.of({
              load: () => Effect.die(new Error("not implemented")),
              reload: () => Effect.void as any,
              dispose: () => Effect.void,
              disposeAll: () => Effect.void,
              provide: (input, effect) => effect,
            }),
          ),
        ),
      ),
    )
  })

  test("manifest roundtrip on disk", async () => {
    const dir = `${process.cwd()}/.tmp-hub-test-${Date.now()}`
    await Bun.write(`${dir}/.gitkeep`, "")
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* ProjectManifest.ensureManifest(dir)
        yield* ProjectManifest.saveManifest(dir, { persona_id: "plan", goal: "Ship project hub" })
        const loaded = yield* ProjectManifest.loadManifest(dir)
        expect(loaded.persona_id).toBe("plan")
        expect(loaded.goal).toBe("Ship project hub")
        yield* ProjectRegistry.ensureRegistry(dir)
      }).pipe(Effect.provide(AppFileSystem.defaultLayer)),
    )
  })

  test("refLockedInBuiltinEnabled marks default bundle skills", () => {
    expect(refLockedInBuiltinEnabled({ enabled_groups: ["default"] }, { groups: [] }, "skill", "agence")).toBe(true)
  })
})
