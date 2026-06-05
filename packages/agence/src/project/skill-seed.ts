import path from "path"
import { Effect } from "effect"
import { AppFileSystem } from "@agence-ai/core/filesystem"
import { MANIFEST_DIR } from "./manifest"
import { installFromGithub } from "./installer"

const SEED_STATE_VERSION = 1
const SEED_STATE_FILE = "skill-seed.json"

/** One git clone per repo id; multiple subpaths reuse the same clone directory. */
export const CURATED_SKILL_INSTALLS = [
  {
    key: "anthropics-skills:frontend-design",
    id: "anthropics-skills",
    github: "https://github.com/anthropics/skills",
    subpath: "skills/frontend-design",
    label: "Anthropic frontend design",
  },
  {
    key: "anthropics-skills:web-artifacts-builder",
    id: "anthropics-skills",
    github: "https://github.com/anthropics/skills",
    subpath: "skills/web-artifacts-builder",
    label: "Anthropic web artifacts builder",
  },
  {
    key: "vercel-labs-agent-skills:web-design-guidelines",
    id: "vercel-labs-agent-skills",
    github: "https://github.com/vercel-labs/agent-skills",
    subpath: "skills/web-design-guidelines",
    label: "Vercel web design guidelines",
  },
  {
    key: "vercel-labs-agent-skills:react-best-practices",
    id: "vercel-labs-agent-skills",
    github: "https://github.com/vercel-labs/agent-skills",
    subpath: "skills/react-best-practices",
    label: "Vercel React best practices",
  },
  {
    key: "kostja94-marketing-skills:seo",
    id: "kostja94-marketing-skills",
    github: "https://github.com/kostja94/marketing-skills",
    subpath: "skills/seo",
    label: "Marketing skills — SEO pack",
  },
  {
    key: "kostja94-marketing-skills:marketing-pages",
    id: "kostja94-marketing-skills",
    github: "https://github.com/kostja94/marketing-skills",
    subpath: "skills/pages/marketing",
    label: "Marketing skills — landing & marketing pages",
  },
  {
    key: "kostja94-marketing-skills:components",
    id: "kostja94-marketing-skills",
    github: "https://github.com/kostja94/marketing-skills",
    subpath: "skills/components",
    label: "Marketing skills — UI components (hero, CTA, …)",
  },
  {
    key: "ericosiu-ai-marketing-skills:clone-site",
    id: "ericosiu-ai-marketing-skills",
    github: "https://github.com/ericosiu/ai-marketing-skills",
    subpath: "clone-site",
    label: "SingleGrain clone-site",
  },
] as const

type SeedState = {
  version: number
  completed: string[]
  failed?: Record<string, string>
}

function seedStatePath(directory: string) {
  return path.join(directory, MANIFEST_DIR, SEED_STATE_FILE)
}

function readSeedState(raw: string): SeedState {
  const parsed = JSON.parse(raw) as Partial<SeedState>
  return {
    version: typeof parsed.version === "number" ? parsed.version : 0,
    completed: Array.isArray(parsed.completed) ? parsed.completed.filter((x) => typeof x === "string") : [],
    failed:
      parsed.failed && typeof parsed.failed === "object"
        ? Object.fromEntries(
            Object.entries(parsed.failed).filter(
              (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string",
            ),
          )
        : undefined,
  }
}

function loadSeedState(directory: string) {
  return Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    const file = seedStatePath(directory)
    if (!(yield* fs.existsSafe(file))) {
      return { version: SEED_STATE_VERSION, completed: [] as string[], failed: {} as Record<string, string> }
    }
    const raw = yield* fs.readFileString(file).pipe(Effect.catch(() => Effect.succeed("{}")))
    const state = yield* Effect.try({
      try: () => readSeedState(raw),
      catch: () => ({ version: 0, completed: [] as string[], failed: {} as Record<string, string> }),
    })
    return {
      version: state.version,
      completed: state.completed,
      failed: state.failed ?? {},
    }
  })
}

function saveSeedState(directory: string, state: SeedState) {
  return Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    yield* fs.writeWithDirs(seedStatePath(directory), JSON.stringify(state, null, 2))
  })
}

export function ensureCuratedSkills(directory: string) {
  return Effect.gen(function* () {
    let state = yield* loadSeedState(directory)
    if (state.version !== SEED_STATE_VERSION) {
      state = { version: SEED_STATE_VERSION, completed: state.completed, failed: {} }
    }

    const completed = new Set(state.completed)
    const failed = { ...state.failed }
    let changed = state.version !== SEED_STATE_VERSION

    for (const item of CURATED_SKILL_INSTALLS) {
      if (completed.has(item.key)) continue
      if (failed[item.key]) continue

      const result = yield* installFromGithub(directory, {
        type: "skill",
        github: item.github,
        subpath: item.subpath,
        id: item.id,
        name: item.label,
      }).pipe(
        Effect.match({
          onFailure: (error) => {
            const message = error instanceof Error ? error.message : String(error)
            failed[item.key] = message
            changed = true
            return undefined
          },
          onSuccess: (value) => value,
        }),
      )

      if (!result) continue
      completed.add(item.key)
      changed = true
    }

    if (changed) {
      yield* saveSeedState(directory, {
        version: SEED_STATE_VERSION,
        completed: [...completed],
        ...(Object.keys(failed).length > 0 ? { failed } : {}),
      })
    }

    return {
      installed: [...completed],
      failed,
    }
  })
}

export function ensureCuratedSkillsBackground(directory: string) {
  return ensureCuratedSkills(directory).pipe(
    Effect.catch((error) => {
      console.warn("[skill-seed] Curated GitHub skills install failed:", error)
      return Effect.succeed({ installed: [] as string[], failed: {} as Record<string, string> })
    }),
    Effect.forkDetach,
  )
}

export * as SkillSeed from "./skill-seed"
