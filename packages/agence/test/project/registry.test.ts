import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { AppFileSystem } from "@agence-ai/core/filesystem"
import {
  appendRefsToInstalledGroup,
  INSTALLED_GROUP_ID,
  loadRegistry,
  wireInstalledRefs,
} from "../../src/project/registry"
import { loadManifest } from "../../src/project/manifest"
import { tmpdir } from "../fixture/fixture"

describe("wireInstalledRefs", () => {
  test("adds refs to installed group and enables it in manifest", async () => {
    await using tmp = await tmpdir({ git: true })

    await Effect.runPromise(
      wireInstalledRefs(tmp.path, [{ type: "skill", ref: "demo-skill" }]).pipe(
        Effect.provide(AppFileSystem.defaultLayer),
      ),
    )

    const registry = await Effect.runPromise(loadRegistry(tmp.path).pipe(Effect.provide(AppFileSystem.defaultLayer)))
    const group = registry.groups?.find((item) => item.id === INSTALLED_GROUP_ID)
    expect(group?.items.some((item) => item.type === "skill" && item.ref === "demo-skill")).toBe(true)

    const manifest = await Effect.runPromise(loadManifest(tmp.path).pipe(Effect.provide(AppFileSystem.defaultLayer)))
    expect(manifest.enabled_groups?.includes(INSTALLED_GROUP_ID)).toBe(true)
  })

  test("appendRefsToInstalledGroup dedupes refs", () => {
    const registry = { groups: [{ id: INSTALLED_GROUP_ID, name: "Installed", items: [{ type: "skill" as const, ref: "a" }] }] }
    appendRefsToInstalledGroup(registry, [
      { type: "skill", ref: "a" },
      { type: "skill", ref: "b" },
    ])
    expect(registry.groups?.[0]?.items).toHaveLength(2)
  })
})
