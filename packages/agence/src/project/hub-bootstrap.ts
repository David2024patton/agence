import { Effect } from "effect"
import { ensureManifest, loadManifest, saveManifest } from "./manifest"
import { ensureRegistry } from "./registry"
import { registerProject } from "./projects-index"

export function ensureHubBundle(directory: string) {
  return Effect.gen(function* () {
    yield* ensureManifest(directory)
    yield* ensureRegistry(directory)
    const manifest = yield* loadManifest(directory)
    const next =
      manifest.persona_id && manifest.enabled_groups?.length
        ? manifest
        : {
            ...manifest,
            persona_id: manifest.persona_id ?? "build",
            enabled_groups: manifest.enabled_groups?.length ? manifest.enabled_groups : ["default"],
          }
    if (next !== manifest) yield* saveManifest(directory, next)
    yield* registerProject(directory)
    const { ensureProjectWiki } = yield* Effect.promise(() => import("../learning/wiki-seed"))
    yield* ensureProjectWiki(directory).pipe(Effect.catch(() => Effect.void))

    const { ensureCuratedSkillsBackground } = yield* Effect.promise(() => import("./skill-seed"))
    yield* ensureCuratedSkillsBackground(directory)
  })
}

export * as HubBootstrap from "./hub-bootstrap"
