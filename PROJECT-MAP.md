# Agence — Project Map & Extension Guide

## Architecture

```
agence/                          # Monorepo root (Bun workspaces)
├── packages/
│   ├── agence/                  # Core: CLI + server + agent + tools
│   │   └── src/
│   │       ├── agent/           # Agent system (prompts, subagent permissions)
│   │       ├── acp/             # Agent Communication Protocol
│   │       ├── bus/             # In-process event bus (PubSub)
│   │       ├── cli/             # CLI framework (yargs + Effect)
│   │       │   └── cmd/tui/     # Terminal UI (SolidJS-based)
│   │       ├── config/          # Config loading (opencode.json, multi-source merge)
│   │       ├── effect/          # Effect runtime integration
│   │       │   ├── app-runtime.ts    # ManagedRuntime with all services
│   │       │   ├── instance-state.ts # Per-project scoped state cache
│   │       │   └── instance-ref.ts   # InstanceRef/WorkspaceRef context
│   │       ├── mcp/             # MCP server/client (Model Context Protocol)
│   │       ├── permission/      # Permission evaluation
│   │       ├── plugin/          # Plugin system (provider plugins)
│   │       ├── project/         # Project management (VCS, bootstrap)
│   │       ├── provider/        # AI provider abstraction (75+ providers)
│   │       ├── pty/             # Pseudo-terminal integration
│   │       ├── server/          # HTTP/WebSocket server (Effect HttpApi)
│   │       │   └── routes/instance/httpapi/
│   │       │       ├── groups/  # API endpoint definitions
│   │       │       ├── handlers/# API endpoint implementations
│   │       │       └── middleware/ # Auth, instance context, workspace routing
│   │       ├── session/         # Session management (messages, prompt templates)
│   │       ├── skill/           # Skill system (SKILL.md discovery)
│   │       ├── learning/        # Memory intelligence, wiki, knowledge paths, archive
│   │       ├── background/      # Heartbeat scheduler (HEARTBEAT.md)
│   │       ├── storage/         # SQLite database (Drizzle ORM)
│   │       ├── sync/            # Sync engine (multi-client state)
│   │       └── tool/            # Tool system (50+ tools)
│   ├── core/                    # Shared library (@agence-ai/core)
│   │   └── src/
│   │       ├── effect/          # Effect runtime (logger, observability)
│   │       ├── plugin/provider/ # 32 provider plugins
│   │       ├── util/            # 18 utilities (log, glob, hash, etc.)
│   │       └── global.ts        # XDG path management
│   ├── app/                     # Web UI (SolidJS SPA)
│   │   └── src/
│   │       ├── pages/           # Page components (home, session, monitor)
│   │       ├── components/      # Reusable components
│   │       └── context/         # State management (command, layout, sync, server)
│   ├── desktop/                 # Electron wrapper
│   │   └── src/
│   │       ├── main/            # Main process (server lifecycle, IPC)
│   │       │   ├── index.ts     # App entry, window creation, sidecar startup
│   │       │   ├── server.ts    # Sidecar lifecycle + health check
│   │       │   ├── sidecar.ts   # Sidecar process (imports virtual:agence-server)
│   │       │   └── ipc.ts       # Renderer ↔ main process communication
│   │       └── preload/         # Context bridge between main/renderer
│   ├── llm/                     # LLM protocol layer
│   ├── ui/                      # Shared UI components
│   ├── plugin/                  # Plugin SDK
│   ├── sdk/                     # External JS SDK + OpenAPI spec
│   ├── console/                 # Management console (SST-based)
│   ├── web/                     # Marketing/docs site (Astro)
│   ├── enterprise/              # Team sharing portal
│   └── ...                      # 10 more packages
├── vendor/                      # Vendored deps (git submodules)
│   ├── agent-browser/           # Browser automation
│   ├── openclaw/                # 137 messaging plugins (Telegram, Discord, etc.)
│   └── lobehub/                 # Multi-agent platform
├── scripts/                     # Utility scripts (DB migration, rename, tests)
├── .opencode/                   # Agent config (skills, commands, plugins, tools)
│   ├── skills/                  # Auto-discovered SKILL.md files
│   ├── command/                 # Custom agent commands
│   ├── plugins/                 # Agent plugins
│   └── tools/                   # Custom tool implementations
├── specs/                       # Design documents
├── infra/                       # SST infrastructure (AWS)
├── AGENCE.md                    # Agent knowledge base
├── PROJECT-MAP.md               # This file
├── docs/                        # Agence-specific docs (vs OpenCode web docs)
│   ├── agence-vs-opencode.md
│   └── learning/                # Memory, wiki, heartbeat, desktop settings
└── migration/                   # 23 Drizzle SQL migrations
```

## Learning subsystem (Agence vs upstream OpenCode)

OpenCode upstream does not ship this stack; see `docs/agence-vs-opencode.md`.

| Concern | Location |
| --- | --- |
| Memory intelligence | `packages/agence/src/learning/memory-intelligence.ts`, `memory-settings.ts`, `memory-tags.ts` |
| Wiki files | `packages/agence/src/learning/wiki.ts`, `knowledge-paths.ts` → `.agence/knowledge/wiki/` |
| Session archive → KB | `packages/agence/src/learning/archive.ts` |
| Heartbeat runner | `packages/agence/src/background/heartbeat.ts` → `HEARTBEAT.md` |
| HTTP groups | `server/routes/instance/httpapi/groups/memory.ts`, `knowledge.ts`, `library.ts`, `heartbeat.ts` |
| HTTP handlers | `handlers/memory.ts`, `knowledge.ts`, `library.ts` (+ heartbeat in library handler) |
| Desktop settings UI | `packages/app/src/components/settings-memory.tsx`, `settings-knowledge.tsx`, `settings-heartbeat.tsx`, `dialog-settings.tsx` (Learning section) |
| Library page | `packages/app/src/pages/library.tsx` → `/library` |
| Instance HTTP client | `packages/app/src/utils/instance-http.ts`, `learning-settings-api.ts` |
| On-disk settings | `.agence/memory-settings.json`, `.agence/heartbeat.json` |

**Desktop:** run `bun dev:desktop` from repo root after server changes (`predev` rebuilds sidecar bundle).

## How the Effect Layer System Works

Agence uses Effect's dependency injection. Every service is a `Layer`:

```ts
// Service definition
export class SessionService extends Context.Service<SessionService, SessionInterface>()("@agence/Session") {}

// Layer provides the implementation
export const layer = Layer.effect(SessionService, Effect.gen(function* () {
  const db = yield* Database.Service
  // ... setup
  return SessionService.of({ create, get, list, remove })
}))

// Composing layers
const AppLayer = Layer.mergeAll(SessionService.layer, ConfigLayer, ProviderLayer, ...)
```

Services are initialized lazily — only when first used. The `InstanceState` system provides per-project scoped caches. A fallback `InstanceRef` is provided at server startup so services can initialize before a project is loaded; the middleware overrides it with the real context per-request.

## Extension Points — How to Add Features

### Level 1: Fully Modular (add 1 file, auto-discovered)

| Feature Type | What to Do | Example |
|-------------|-----------|---------|
| **Tool** | Add `packages/agence/src/tool/mytool.ts` containing `export const definition = Tool.define({...})`. Register in `src/tool/registry.ts`. Optionally add `mytool.txt` prompt template in same directory. | `browser.ts`, `screenshot.ts`, `weather.ts` |
| **MCP Server** | Add to the `mcp` section of `~/.config/agence/opencode.jsonc`. 50+ tools from Desktop Commander instantly become available. | `"desktop-commander": {"type": "local", "command": ["npx", "-y", "@wonderwhy-er/desktop-commander@latest"]}` |
| **Skill** | Drop a `SKILL.md` in `.opencode/skills/<name>/`. YAML frontmatter for metadata, Markdown body for instructions. Auto-discovered on startup. Also scanned from `directories.skills` paths and binary parent directory. | `.opencode/skills/tool-tester/SKILL.md` |
| **Provider Plugin** | Add file to `core/src/plugin/provider/myprovider.ts`. Must export a `PluginV2.define({...})` object with provider configuration (base URL, headers, models). Register in `core/src/plugin/provider/index.ts`. | `openai.ts`, `anthropic.ts`, `groq.ts` |
| **Custom Command** | Drop a `.md` file in `.opencode/command/`. The filename becomes the command name. Uses Markdown frontmatter for metadata. | `.opencode/command/deploy.md` |
| **UI Theme** | Drop a `.json` in `.opencode/themes/`. Must match the theme JSON schema. | `.opencode/themes/mytheme.json` |
| **Desktop Menu Item** | Add `{ type: "item", label: "My Feature", command: "myfeature.open" }` to `packages/app/src/desktop-menu.ts`. Handle the command in the renderer. | Monitor menu item (`monitor.open`) |
| **Config Section** | Create `src/config/myconfig.ts` with a `Schema.Struct({...})`. Import and add field to the `Info` struct in `src/config/config.ts`. Users configure it in `opencode.jsonc`. | `directories.ts`, `skills.ts` |

### Level 2: Follow a Pattern (add 2-3 files in specific places)

| Feature Type | Files Needed | Registration |
|-------------|-------------|-------------|
| **API Endpoint** | 1. `groups/myfeature.ts` — paths + schemas + group definition<br>2. `handlers/myfeature.ts` — handler implementations (`HttpApiBuilder.group(...)`) | 3. In `api.ts`: add `.addHttpApi(MyFeatureApi)` to `InstanceHttpApi`<br>4. In `server.ts`: import handler and add to `Layer.provide([...])` |
| **CLI Command** | 1. `cli/cmd/mycommand.ts` — command definition with `effectCmd({...})` | 2. In `src/index.ts`: add `.command(MyCommand)` to the yargs CLI |
| **Database Table** | 1. `src/myfeature.sql.ts` — Drizzle table definition<br>2. `migration/<YYYYMMDDHHMMSS>_name/` — migration SQL + snapshot | Migrations auto-applied on startup via `Database.Client()` |
| **UI Page** | 1. `packages/app/src/pages/mypage.tsx` — SolidJS page component | 2. In `app.tsx`: lazy-load + add `<Route path="/mypage" component={MyPage} />` |
| **Effect Service** | 1. `src/myfeature/index.ts` — service definition + layer | 2. In `effect/app-runtime.ts`: add to `AppLayer`<br>3. In `server/.../server.ts`: add to `createRoutes()` |
| **Subagent** | 1. `src/agent/prompt/myagent.txt` — prompt template<br>2. `src/agent/agent.ts` — register in agent config | |

### Level 3: External Package / Vendor

| Feature Type | How |
|-------------|-----|
| **Desktop Commander** | External MCP server installed via npm. Configured in `opencode.jsonc` `mcp` field. Provides 50+ file/terminal/process tools. |
| **OpenClaw Plugin** | Drop a directory in `vendor/openclaw/extensions/`. Provides messaging gateway plugins (Telegram, Discord, WhatsApp, etc.). Discovered by `openclaw_gateway.ts`. |
| **Agent Browser** | Binary dependency in `vendor/agent-browser/`. Provides browser automation (CDP). Called via `tool/browser.ts`. |

### Real Example: The Monitor Feature (we just built this)

Here's exactly what we added to create the monitoring system:

1. **`groups/monitor.ts`** (68 lines) — API group definition:
   ```ts
   export const MonitorApi = HttpApi.make("monitor").add(
     HttpApiGroup.make("monitor")
       .add(HttpApiEndpoint.get("state", "/monitor/state", {...}))
       .add(HttpApiEndpoint.get("events", "/monitor/events", {...}))
   )
   ```

2. **`handlers/monitor.ts`** (100 lines) — Handler implementation:
   ```ts
   export const monitorHandlers = HttpApiBuilder.group(InstanceHttpApi, "monitor", (handlers) =>
     Effect.gen(function* () {
       // Subscribe to bus, track sessions/commands/errors in memory
       // stateHandler: returns JSON snapshot
       // eventStream: returns SSE event stream
       return handlers.handle("state", stateHandler).handleRaw("events", eventStream)
     })
   )
   ```

3. **`pages/monitor.tsx`** (115 lines) — SolidJS dashboard page:
   ```tsx
   export default function MonitorPage() {
     // Auto-refreshes state every 5 seconds
     // Shows server health, active sessions, command count, event feed
     // Displays LLM endpoint info
   }
   ```

4. **Registration changes** (3 files, ~5 lines each):
   - `api.ts`: `import { MonitorApi } from "./groups/monitor"` + `.addHttpApi(MonitorApi)`
   - `server.ts`: `import { monitorHandlers } from "./handlers/monitor"` + add to `Layer.provide([...])`
   - `app.tsx`: `const Monitor = lazy(() => import("@/pages/monitor"))` + `<Route path="/monitor" component={Monitor} />`

5. **Menu item** (desktop-menu.ts): `{ type: "item", label: "Monitor", command: "monitor.open", accelerator: {...} }`

**Total: 3 new files, ~10 lines of registration changes.**

## Key Config Paths

| What | Path |
|------|------|
| Global config | `~/.config/agence/opencode.jsonc` |
| Database (dev) | `~/.local/share/agence/agence-dev.db` |
| Database (prod) | `~/.local/share/agence/agence.db` |
| Server logs | `~/.local/share/agence/log/dev.log` |
| Desktop logs | `%APPDATA%/ai.agence.desktop.dev/logs/` |
| Desktop data | `%APPDATA%/ai.agence.desktop.dev/` |
| Project config | `.opencode/opencode.jsonc` |
| Project store | `.git/agence` (project ID cache) |

## Critical Files Cheat Sheet

| Task | File |
|------|------|
| Change app name/paths | `packages/core/src/global.ts` |
| Add MCP server | `~/.config/agence/opencode.jsonc` → `mcp` field |
| Add tool | `packages/agence/src/tool/` + `registry.ts` |
| Add API endpoint | `groups/` + `handlers/` + `api.ts` + `server.ts` |
| Add database table | `*.sql.ts` + `migration/<timestamp>_<name>/` |
| Add CLI command | `packages/agence/src/cli/cmd/` + `src/index.ts` |
| Change default prompt | `packages/agence/src/session/prompt/default.txt` |
| Fix desktop issues | `packages/desktop/src/main/sidecar.ts` + `server.ts` |
| Debug startup crashes | Check `InstanceRef` in `packages/agence/src/effect/instance-state.ts` |
| Add desktop menu item | `packages/app/src/desktop-menu.ts` + route in `app.tsx` |
| Add titlebar icon | `packages/app/src/components/titlebar.tsx` — add `<IconButton>` in the same row as `StatusPopover`. Use `window.dispatchEvent(new CustomEvent(...))` for click actions. Listen in the target component with `window.addEventListener`. |
| Memory / learning API | `groups/memory.ts` (etc.) + `handlers/` + register in `api.ts` + `server.ts` — see `docs/learning/` |
| Project directory gate | `packages/agence/src/project/require-project.ts` + `handlers/instance-scope.ts` + `middleware/instance-context.ts` |
| New user guide | `docs/getting-started.md` (wiki-seed → `.agence/knowledge/wiki/getting-started.md`) |
| Project Hub / bundle | `packages/agence/src/project/hub.ts`, `hub-bootstrap.ts`, `manifest.ts`, `registry.ts` — see `docs/project-hub.md` |
| Learning settings page | `packages/app/src/components/settings-*.tsx` + tab in `dialog-settings.tsx` |
| Add config option | `packages/agence/src/config/` + register in `config.ts` |

## Titlebar Icons (How-To)

Titlebar icons render in the window frame, next to the minimize/maximize/close buttons. To add one:

1. In `titlebar.tsx`, find the `StatusPopover` section (~line 468-476)
2. Add your icon button AFTER the `</Show>` that wraps StatusPopover:
   ```tsx
   <Show when={currentSessionTab()?.dir}>
     <Tooltip placement="bottom" value="Memory">
       <IconButton icon="archive" variant="ghost" size="small"
         class="titlebar-icon w-6 h-6"
         onClick={() => window.dispatchEvent(new CustomEvent("agence:memory:toggle"))}
         aria-label="Memory" />
     </Tooltip>
   </Show>
   ```
3. In the target component (e.g., `session-side-panel.tsx`), listen for the event:
   ```tsx
   onMount(() => {
     const handler = () => { /* toggle your panel */ }
     window.addEventListener("agence:myevent:toggle", handler)
     onCleanup(() => window.removeEventListener("agence:myevent:toggle", handler))
   })
   ```
4. Use `CustomEvent` for cross-component communication since the titlebar doesn't share session context.

## Runtime Flow

```
User types in desktop app
        ↓
Renderer (SolidJS) → SDK client → HTTP request with x-opencode-directory header
        ↓
Electron main process → sidecar process (utilityProcess.fork)
        ↓
Sidecar → imports virtual:agence-server → Server.listen()
        ↓
Effect HTTP server → workspaceRouterMiddleware extracts directory
        ↓
assertProjectDirectory() → ensureHubBundle if new → InstanceStore.load() → InstanceBootstrap
        ↓
Handler processes request → returns response → SDK → renderer updates UI
```

## Debugging

| Method | How |
|--------|-----|
| Sidecar log level | `$env:AGENCE_LOG_LEVEL="DEBUG"; bun dev:desktop` |
| Desktop DevTools | `Ctrl+Shift+I` in the Electron window |
| Server health | `GET http://localhost:<port>/global/health` |
| Live events | `GET http://localhost:<port>/event` (SSE stream) |
| Monitor state | `GET http://localhost:<port>/monitor/state` (JSON) |
| Monitor live feed | `GET http://localhost:<port>/monitor/events` (SSE) |
| Server stderr | Check desktop logs at `%APPDATA%/ai.agence.desktop.dev/logs/` |
| Server log file | `~/.local/share/agence/log/dev.log` |

## GitHub Actions / CI

The `.github/workflows/` directory has 26 workflow files. The most important:

| Workflow | Purpose | When it runs |
|----------|---------|-------------|
| `agence.yml` | AI agent in PRs — responds to `/agence` or `/oc` comments | On issue/PR comment |
| `test.yml` | Run all tests and typecheck across packages | On push to dev, PRs |
| `typecheck.yml` | TypeScript type checking across all packages | On push to dev, PRs |
| `publish.yml` | Build and publish npm packages + desktop binaries | On tag/release |
| `beta.yml` | Beta release automation | Scheduled + manual |
| `review.yml` | AI code review on PRs | On PR |
| `storybook.yml` | Deploy Storybook to GitHub Pages | On push to dev |
| `pr-management.yml` | Auto-label and manage PRs | On PR events |
| `pr-standards.yml` | Enforce PR title/description standards | On PR |
| `triage.yml` | Auto-triage new issues | On new issue |

## Build Process

```
1. bun install          # Resolve workspace dependencies
2. bun dev:desktop      # Start dev (does all below automatically)
   ├── bun ./scripts/predev.ts       # Copy icons, build node.js
   │   └── bun run script/build-node.ts  # Bundles agence/src → dist/node/node.js (~20MB)
   │       ├── Post-build: patches "undefined" string literals (esbuild SSR bug)
   │       └── Inlines 23 migration files for embedded DB init
   ├── electron-vite dev             # Builds Electron main + preload + renderer
   │   ├── out/main/sidecar.js       # Sidecar process script (~4KB)
   │   ├── out/main/index.js         # Main process (~97KB)
   │   └── out/main/chunks/node-*.js # Full server bundle (~21MB)
   └── starts Electron app
       ├── Spawns sidecar (utilityProcess.fork)
       │   └── Sidecar imports virtual:agence-server → node-*.js chunk
       │       └── Server.listen() → HTTP server on localhost
       └── Opens desktop window → loads renderer from localhost:5173 (vite dev)
```

## Testing

Tests use Bun's test runner. Each package has its own `test/` directory mirroring `src/`.

| Package | Test Count | How to Run |
|---------|-----------|-----------|
| `packages/agence/` | ~200 test files | `cd packages/agence && bun test` |
| `packages/core/` | ~20 test files | `cd packages/core && bun test` |
| `packages/llm/` | ~30 test files | `cd packages/llm && bun test` |
| `packages/app/` | E2E + unit | `cd packages/app && bun test` |

**Key testing notes:**
- Tests CANNOT run from repo root (guard: `do-not-run-tests-from-root`)
- CLI tests spawn real agence processes via `test/lib/cli-process.ts`
- Server tests start real HTTP servers on random ports
- LLM tests use recorded HTTP fixtures (no real API calls needed)
- Provider tests use factory-based mocks
- Effect tests use `test/lib/effect.ts` for runner setup

## Common Rename Pitfalls

When renaming from `opencode` to `agence`, these patterns caused issues:

| Pattern | Why it broke | Fix |
|---------|-------------|-----|
| `opencode/` in user-agent strings | Protected by regex because `/` follows | Manual fix needed |
| `opencode-` in `opencode-${safe}.db` | Protected by regex because `-` follows | DB filename mismatch |
| `~opencode/InstanceRef` | Protected by regex because `~` precedes | Left as-is (internal ref) |
| `Effect.tryPromise({try, catch})` | Effect v4 object form requires `catch` in options | Use `Effect.sync` instead |
| `@opencode-ai/plugin` npm package | Doesn't exist on registry | Keep `@opencode-ai/plugin` for npm install |
| `export { workspaceID }` accidentally removed | Lost during revert of `safeContext` edit | Restored manually |
