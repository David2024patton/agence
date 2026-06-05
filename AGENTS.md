# agence — Agent Instructions

**Before modifying any code, read `PROJECT-MAP.md`** — the full architecture map, extension guide, and file cheat sheet.

- To regenerate the JavaScript SDK, run `./packages/sdk/js/script/build.ts`.
- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
- The default branch in this repo is `dev`.
- Local `main` ref may not exist; use `dev` or `origin/dev` for diffs.
- Prefer automation: execute requested actions without confirmation unless blocked by missing info or safety/irreversibility.

## Commits and PR Titles

Use conventional commit-style messages and PR titles: `type(scope): summary`.

Valid types are `feat`, `fix`, `docs`, `chore`, `refactor`, and `test`. Scopes are optional; use the affected package or area when helpful, e.g. `core`, `agence`, `tui`, `app`, `desktop`, `sdk`, or `plugin`.

Examples: `fix(tui): simplify thinking toggle styling`, `docs: update contributing guide`, `chore(sdk): regenerate types`.

## Style Guide

### General Principles

- Keep things in one function unless composable or reusable
- Do not extract single-use helpers preemptively. Inline the logic at the call site unless the helper is reused, hides a genuinely complex boundary, or has a clear independent name that improves the caller.
- Avoid `try`/`catch` where possible
- Avoid using the `any` type
- Use Bun APIs when possible, like `Bun.file()`
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity
- Prefer functional array methods (flatMap, filter, map) over for loops; use type guards on filter to maintain type inference downstream
- In `src/config`, follow the existing self-export pattern at the top of the file (for example `export * as ConfigAgent from "./agent"`) when adding a new config module.

Reduce total variable count by inlining when a value is only used once.

```ts
// Good
const journal = await Bun.file(path.join(dir, "journal.json")).json()

// Bad
const journalPath = path.join(dir, "journal.json")
const journal = await Bun.file(journalPath).json()
```

### Destructuring

Avoid unnecessary destructuring. Use dot notation to preserve context.

```ts
// Good
obj.a
obj.b

// Bad
const { a, b } = obj
```

### Variables

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment.

```ts
// Good
const foo = condition ? 1 : 2

// Bad
let foo
if (condition) foo = 1
else foo = 2
```

### Control Flow

Avoid `else` statements. Prefer early returns.

```ts
// Good
function foo() {
  if (condition) return 1
  return 2
}

// Bad
function foo() {
  if (condition) return 1
  else return 2
}
```

### Complex Logic

When a function has several validation branches or supporting details, make the main function read as the happy path and move supporting details into small helpers below it.

```ts
// Good
export function loadThing(input: unknown) {
  const config = requireConfig(input)
  const metadata = readMetadata(input)
  return createThing({ config, metadata })
}

function requireConfig(input: unknown) {
  ...
}
```

- Keep helpers close to the code they support, below the main export when that improves readability.
- Do not over-abstract simple expressions into many single-use helpers; extract only when it names a real concept like `requireConfig` or `readMetadata`.
- Do not return `Effect` from helpers unless they actually perform effectful work. Synchronous parsing, validation, and option building should stay synchronous.
- Prefer Effect schema helpers such as `Schema.UnknownFromJsonString` and `Schema.decodeUnknownOption` over manual `JSON.parse` wrapped in `Effect.try` when parsing untrusted JSON strings.
- Add comments for non-obvious constraints and surprising behavior, not for obvious assignments or control flow.

### Schema Definitions (Drizzle)

Use snake_case for field names so column names don't need to be redefined as strings.

```ts
// Good
const table = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
  created_at: integer().notNull(),
})

// Bad
const table = sqliteTable("session", {
  id: text("id").primaryKey(),
  projectID: text("project_id").notNull(),
  createdAt: integer("created_at").notNull(),
})
```

## Testing

- Avoid mocks as much as possible
- Test actual implementation, do not duplicate logic into tests
- Tests cannot run from repo root (guard: `do-not-run-tests-from-root`); run from package dirs like `packages/agence`.

## Type Checking

- Always run `bun typecheck` from package directories (e.g., `packages/agence`), never `tsc` directly.

## Learned User Preferences

- Expects automated memory intelligence (auto-capture, consolidation, decay scoring, cross-layer links, global preference/identity recall) with granular metadata (`layer`, tags like `UI`, `workflow`) rather than relying only on manual `memory_add`.
- Wants **Settings → Learning** for **Memory** and **Knowledge** (expandable sub-nav for nested pages such as ingest/RAG); **Heartbeat** is its own top-level Settings category, not under Learning.
- Expects **hover/long-press tooltips** on Settings controls with plain-language explanations and short examples (especially Maintenance toggles); **not** on composer model/mode/thinking selectors. Prefers **visible thin scrollbars** on long Settings pages (`settings-scrollbar`), not hidden `no-scrollbar` overflow.
- Prefers **plain-text clipboard paste** in chat as a `.txt` file attachment, not inline wall-of-text.
- Wants **document upload** into memory from Settings (PDF, Word, `.md`, `.txt`, etc.), not only script or heartbeat ingest.
- Prefers the **projects sidebar collapsed on launch**, with a collapse control beside the top-left menu.
- Dislikes **modal pop-up confirmations** in the desktop app; prefer inline toasts or silent saves.
- After `packages/agence` backend changes while running desktop dev, restart with `bun dev:desktop` so `predev` rebuilds the sidecar bundle; hard-refresh or fully relaunch Electron if a stale bundled chunk still causes runtime errors.
- Treat **Build**, **Plan**, and **Deep research** as prompt **chat modes** (server-enforced tool restrictions), not separate agents; **Plan** may edit only plan/report markdown paths; **Deep research** must finish with a written report under `.agence/knowledge/wiki/research/` or `.agence/knowledge/reports/` without being asked each turn; mode persists in `prompt-chat-mode`. **Project Goals** (Project Hub → Goal or `/goal`) live in **`project.json`** + **`.agence/goal.json`** per project, shared across all sessions: reminders, auto-continue, `goal_complete`.
- Wants **OpenCode Zen free models** (`cost.input === 0`) listed first within each provider in model pickers.
- Wants **everything project-scoped** with **projects as installable bundles**: no agent chat, skills, MCPs, or personas unless a project directory is open (API **400** without `directory` or `x-opencode-directory`); `.agence/project.json` ties persona, default model, and resource **groups** together; **Project Hub** (per-project config, not global Settings) opens from the **projects sidebar panel** (Hub/gear button), not a gear on the project row; sectioned persona/skills/MCP/bundle UI with dedicated sub-pages per resource type; custom personas are created/edited in Hub and saved to **`.agence/agents/*.md`**; resources also install via upload/**GitHub link** (OpenCode-compatible `.opencode/agents/` formats); subagents run in parallel with worktree isolation. Wants **Agence runnable as an MCP server** (`agence mcp serve`) so external LLMs get the same persona/tools/knowledge.
- Wants **SkillOpt-style self-evolving skills**: optimize procedural skills from session traces via Settings and heartbeat maintenance (`fn:skill-opt`), not manual-only skill edits.

## Learned Workspace Facts

- Local desktop dev is `bun dev:desktop` (repo root; `--cwd packages/desktop`); `scripts/predev.ts` rebuilds the sidecar bundle. Packaged **`prod`** (`AGENCE_CHANNEL` → `VITE_AGENCE_CHANNEL`) ships the older UI; **`dev`** / **`beta`** get v2 composer, sidebar rail links, and expanded Settings. Esbuild may omit namespace re-exports - import sidecar-critical code from source; `SystemPrompt.defaultLayer` must `Layer.provide(Skill.defaultLayer)`.
- Root **`.gitignore`** excludes **`.cursor/`**, **`.agence/`**, `**/typecheck*.log`, `server*.log`, and **`.env*`** so local dev artifacts stay out of commits.
- Learning and memory code lives under **`packages/agence/src/learning/`** (`memory-intelligence`, `memory-settings`, `wiki`, `archive`, **`reflect.ts`**, **`skill-opt.ts`**) with HTTP routes under `/memory/*`, `/knowledge/*`, `/library/*`, **`/skill-opt/*`**, and heartbeat routes. **SkillOpt** persists **`.agence/skill-opt-settings.json`** / **`.agence/skill-opt-state.json`**; heartbeat **`fn:skill-opt`** runs maintenance.
- Per-project memory toggles persist in **`.agence/memory-settings.json`** (optional **`.agence/memory-export.json`**); cross-project preferences/identity use project id **`__global__`**.
- **models.dev** provider ids: `opencode` for OpenCode Zen (legacy `agence` alias), `opencode-go` for OpenCode Go; Zen OAuth URL is **`https://opencode.ai/zen`**. Disconnecting a provider must persist **`config.disabled_providers`** or env API keys re-attach on reload.
- This codebase uses Effect v4 APIs: **`Effect.catch`** (not `Effect.catchAll`) and **`Effect.forkDetach`** (not `Effect.forkDaemon`).
- Project heartbeat reads **`HEARTBEAT.md`**; last-run times in **`.agence/heartbeat.json`**; prompts prefixed **`cmd:`** or **`fn:`** run scripts or built-ins without an LLM.
- App learning HTTP uses **`packages/app/src/utils/instance-http.ts`** (typed SDK has no raw `.get()` / `.post()`). Settings resolve the active project via **`useSettingsWorkspaceDirectory()`**; **`learning-settings-api.ts`** retries alternate `/knowledge/*`, `/library/*`, and `/heartbeat/*` prefixes on older sidecars. **`/monitor`** (`monitor.tsx`, `GET /monitor/state`) is the sidecar ops dashboard.
- Project **wiki** articles live in **`.agence/knowledge/wiki/`**; sidebar **Knowledge** opens **`/library`**. Product docs: **`docs/`** (`docs/getting-started.md`, `docs/agence-vs-opencode.md`, `docs/learning/*`).
- GitHub **`main`** is stable; **`dev`** is for experiments. Packaged desktop updates use **GitHub Releases** (`electron-updater`); private-repo release URLs 404 without authenticated repo access.
- Fix/incident notes live in **`AGENCE.md`** and **`docs/solutions/*.md`**; ingest via **`ingestMarkdownDocToMemory`** (heartbeat **`fn:memory-ingest-doc <path>`**). **`src/learning/wiki-seed.ts`** seeds bundled **`wiki-seed/*.md`** into **`.agence/knowledge/wiki/`**.
- Project-bundle/hub code lives in **`packages/agence/src/project/`** (`manifest.ts`, `registry.ts`, `installer.ts`, `hub.ts`, **`hub-bootstrap.ts`**, **`require-project.ts`** (`assertProjectDirectory`), **`projects-index.ts`**, **`persona.ts`** → **`.agence/agents/*.md`**, `/hub/persona/save`, `GET /hub/persona`) with HTTP scoping in **`handlers/instance-scope.ts`** (`withProjectDirectory`, `withProjectInstance`) and **`middleware/instance-context.ts`**. GitHub/upload installs write to **`.agence/installs/{id}/`** (skills as **`SKILL.md`**); **`wireInstalledRefs`** registers them in **`registry.json`**. MCP: **`agence mcp serve --global`** lists all projects; **`agence mcp serve -d <dir>`** runs per-project hub, memory, proxied `mcp__*` tools. Opening a project auto-runs **`ensureHubBundle`** (manifest, registry, wiki seed, index entry).
