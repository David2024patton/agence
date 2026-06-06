# Agence Knowledge Base

> **New to the codebase? Read `PROJECT-MAP.md` first** — architecture map, extension guide, where every file lives, and how to add features.

Project: **Agence** — Modular agent + MCP server framework by David Patton
Forked from: [anomalyco/opencode](https://github.com/anomalyco/opencode)
Private repo: `github.com/David2024patton/agence`
Upstream: `github.com/anomalyco/agence` (original agence)

---

## Architecture

### Core stack
- **Runtime:** Bun 1.3.14+
- **Language:** TypeScript 5.8
- **Framework:** Effect v4 (beta) — layered services with DI
- **AI SDK:** Vercel AI SDK v6
- **Database:** SQLite via Drizzle ORM
- **Desktop:** Electron + SolidJS
- **Web app:** SolidJS (Vite)
- **Build:** Turborepo (monorepo)

### Package layout
```
packages/
  agence/         — CLI + server + tools + agent loop + learning/
  app/            — SolidJS web UI (desktop + dev)
  desktop/        — Electron wrapper + sidecar
  core/           — Shared: filesystem, global paths, models-dev
  ui/             — Shared UI components (SolidJS)
  sdk/js/         — TypeScript SDK for REST API
  plugin/         — Plugin type definitions
  llm/            — LLM event types
  web/            — Marketing/docs site (mostly upstream OpenCode MDX)
```

**Agence-specific docs:** `docs/` (start at `docs/agence-vs-opencode.md`). **Architecture map:** `PROJECT-MAP.md`.

### Key architectural patterns
- **Effect Services:** Every subsystem is an Effect `Context.Service` with Tag, Interface, layer, and defaultLayer
- **InstanceState:** Per-project state via ScopedCache; auto-cleaned on project close
- **Tool Registry:** All tools defined via `Tool.define(id, Effect.gen(...))` and registered in `tool/registry.ts`
- **Session Processor:** Agent loop in `session/processor.ts` streams LLM events → tool calls → results
- **Config:** `agence.json` / `agence.jsonc` — global at `~/.config/agence/`, project-level

---

## What We've Built (45 Tools)

### System Tools (7)
- `system_info` — OS, CPU, RAM, hostname, uptime
- `weather` — Current conditions via wttr.in
- `drives` — List drives/mounts with sizes
- `os_open` — Open files/URLs with OS default app
- `env_read` — Read .env with masked values
- `env_write` — Set/delete .env variables
- `lint` — Run tsc, ruff, cargo clippy, markdownlint

### Desktop/CoDriver Tools (2)
- `screenshot` — Desktop PNG capture (cross-platform)
- `powershell` — Dedicated PowerShell executor

### Browser Tools (6)
- `browser_inspect` — Open URL, get accessibility tree + screenshot
- `browser_tutorial` — Animated overlays (circles, glows, arrows)
- `browser_extract` — CSS styles, colors, fonts from any element
- `browser_analyze` — Framework detection (React, Vue, Next.js, etc.)
- `browser_screenshot` — Screenshot current browser page
- `browser_close` — Clean browser session shutdown

### Learning subsystem (Memory + wiki + heartbeat)

Not in stock OpenCode — see `docs/learning/README.md`.

| Piece | Location |
| --- | --- |
| SQLite memory + auto-capture | `src/learning/memory-intelligence.ts` |
| Per-project toggles | `.agence/memory-settings.json` |
| Wiki articles | `.agence/knowledge/wiki/*.md` |
| Scheduled tasks | `HEARTBEAT.md`, `.agence/heartbeat.json` |
| Desktop settings | Settings → Learning (Memory / Knowledge / Heartbeat) |
| Library UI | `/library`, sidebar Knowledge (archive icon) |

HTTP: `/memory/*`, `/library/*`, `/knowledge/*`, `/heartbeat/*` (see `docs/learning/`).

### Self-Learning Task System (7)
- `todowrite` — Create/update tasks with subtasks, tags, dependencies
- `todoread` — Read tasks (by session or cross-session)
- `task_search` — Cross-session search
- `todo_carry` — Forward tasks to new sessions
- `reflect` — Create SKILL.md from completed work
- `model_learn` — Build concept map in `.agence/model/concepts.jsonl`
- `quality_gate` — Auto-create skill from failures

### Image/Vision Tools (2)
- `image_describe` — OCR (OCR.space cloud + tesseract + Ollama vision fallback)
- Vision pipeline in `message-v2.ts` auto-strips images for non-vision models

### Local Inference Discovery
- Auto-detects: Ollama (11434), LM Studio (1234), vLLM (8000), LocalAI (8080), llama.cpp (8081)
- Each appears as a separate provider: "Ollama (local)", "LM Studio (local)", etc.
- Hardcoded into models database for immediate visibility
- Models populated at startup via port probes

### Vendored Dependencies
- `vendor/agent-browser/` — Vercel's browser automation CLI (git submodule)
  - Install: `npm install -g agent-browser && agent-browser install`
  - Called via shell as `agent-browser --json open/snapshot/click/screenshot/etc`

---

## Config Paths (Rebranded from agence)

| Directory | Old path | New path |
|-----------|----------|----------|
| Config | `~/.config/opencode/` | `~/.config/agence/` |
| Data | `~/.local/share/opencode/` | `~/.local/share/agence/` |
| Cache | `~/.cache/opencode/` | `~/.cache/agence/` |
| State | `~/.local/state/opencode/` | `~/.local/state/agence/` |
| Desktop app ID | `ai.opencode.desktop` | `ai.agence.desktop` |
| Protocol scheme | `agence://` | `agence://` |
| Settings store | `agence.settings` | `agence.settings` |

Env var override: `AGENCE_CHANNEL=dev|beta|prod` (was `AGENCE_CHANNEL`)

---

## Key Files We Modified

### Tools
- `packages/agence/src/tool/todo.ts` — Full task system (todowrite, todoread, task_search, todo_carry, reflect, model_learn, quality_gate)
- `packages/agence/src/tool/browser.ts` — Browser automation (inspect, tutorial, extract, analyze, screenshot, close)
- `packages/agence/src/tool/screenshot.ts` — Desktop screenshot
- `packages/agence/src/tool/powershell.ts` — PowerShell tool
- `packages/agence/src/tool/weather.ts` — Weather via wttr.in
- `packages/agence/src/tool/system_info.ts` — System info
- `packages/agence/src/tool/drives.ts` — Drive listing
- `packages/agence/src/tool/os_open.ts` — Open files
- `packages/agence/src/tool/env_read.ts` / `env_write.ts` — Env var management
- `packages/agence/src/tool/lint.ts` — Multi-language linting
- `packages/agence/src/tool/image_describe.ts` — Image OCR/vision
- `packages/agence/src/tool/registry.ts` — Tool registration

### Core Systems
- `packages/agence/src/session/todo.ts` — Todo service with history, search, carry
- `packages/agence/src/session/session.sql.ts` — DB schema (TodoTable, TaskHistoryTable)
- `packages/agence/src/session/message-v2.ts` — Vision model detection + image stripping
- `packages/agence/src/provider/provider.ts` — Local provider auto-discovery + database entries
- `packages/agence/src/provider/local-providers.ts` — Port probing logic
- `packages/agence/src/storage/json-migration.ts` — Migration fix for new schema
- `packages/core/src/global.ts` — App path changed from "agence" to "agence"

### Desktop UI
- `packages/desktop/electron-builder.config.ts` — Rebranded app name, ID, publish config
- `packages/desktop/electron.vite.config.ts` — Virtual module renamed
- `packages/desktop/src/main/index.ts` — App names, env vars, protocol
- `packages/desktop/src/main/server.ts` — External server mode + config functions
- `packages/desktop/src/main/sidecar.ts` — Server username, env vars
- `packages/desktop/src/main/logging.ts` — Log paths
- `packages/desktop/src/main/windows.ts` — Window title
- `packages/desktop/src/main/constants.ts` — Keys
- `packages/desktop/src/main/ipc.ts` — External server IPC handlers
- `packages/desktop/src/main/env.d.ts` — Virtual module type
- `packages/desktop/src/preload/types.ts` — API type
- `packages/desktop/src/preload/index.ts` — IPC bridge
- `packages/desktop/src/renderer/index.html` — Title
- `packages/desktop/src/renderer/loading.html` — Title
- `packages/desktop/src/renderer/i18n/en.ts` — i18n strings
- `packages/desktop/scripts/predev.ts` — Channel env var
- `packages/desktop/scripts/utils.ts` — Channel env var

### Web UI
- `packages/app/index.html` — Title
- `packages/app/src/i18n/en.ts` — All brand strings
- `packages/app/src/components/settings-general.tsx` — External server toggle
- `packages/app/src/components/dialog-settings.tsx` — App name
- `packages/app/src/context/platform.tsx` — External server API type
- `packages/app/src/desktop-menu.ts` — Menu labels
- `packages/ui/src/components/favicon.tsx` — PWA name

### DB Migrations
- `packages/agence/migration/20260523164657_add_todo_id_description_parent/` — Todo: id, description, parentId
- `packages/agence/migration/20260523171744_add_task_deps_tags_history/` — Todo: dependsOn, tags + TaskHistoryTable

---

## Running

```powershell
cd C:\Users\David\AI\agence

# Desktop dev (rebuilds sidecar via predev)
bun dev:desktop

# CLI / TUI dev
bun run --cwd packages/agence dev

# Build node bundle only (sidecar / CLI)
bun run --cwd packages/agence script/build-node.ts

# Serve mode (REST API)
bun run --cwd packages/agence serve --port 9123

# Typecheck (always from package dir, not repo root)
bun run --cwd packages/agence typecheck
bun run --cwd packages/app typecheck
```

---

## Git Workflow

```powershell
# Push to private repo
git push origin dev --no-verify

# Pull upstream agence changes
git pull upstream dev
```

---

## Publishing (Auto-Updater)

The desktop app uses `electron-updater` pointing at:
```
github.com/David2024patton/agence
```

To trigger updates: create a GitHub Release with a newer version tag.
Auto-updater activates only in packaged (production) builds.

---

## Cloud Platform / LLM Resale (Future Work)

The monorepo contains a full Cloudflare-deployed SaaS platform for selling LLM API access:
- `packages/console/app/` — SolidStart web app (agence.ai)
- `packages/console/core/` — Billing, auth, database (PlanetScale MySQL)
- `packages/console/function/` — Auth worker (OpenAuth)
- `packages/function/` — API worker + session sharing (Hono)
- `infra/` — SST (Ion) infrastructure definitions

### What's needed to deploy:
1. Cloudflare account (Workers, KV, R2)
2. PlanetScale MySQL database (~$39/mo)
3. Stripe account (2.9% + $0.30/txn)
4. Provider API keys (OpenAI, Anthropic, etc.)
5. Custom domain

### Simpler MVP alternative:
1. VPS (Hetzner $8/mo or Railway)
2. Simple OpenAI-compatible proxy with Stripe billing
3. SQLite instead of PlanetScale
4. One provider to start

### Subscription Usage Windows

Three strategies for rate limiting, all lazy-reset (no cron needed):

**Rolling window** (e.g., "500 requests per 5 hours"):
```
windowMs = 5 * 3600 * 1000
windowStart = now - windowMs

if lastUsage < windowStart:
  usage = 0  // window expired, auto-reset
elif usage < limit:
  usage++     // within limit, allow
else:
  reject()   // rate limited
```

**Fixed calendar** (e.g., "10,000 per month"):
```
monthStart = Date(now.year, now.month, 1)
if lastUsage < monthStart:
  usage = 0
```

**Weekly** — resets each Monday.

DB schema stores `rollingUsage` + `timeRollingUpdated`. Counter resets on next request after window expiry. Credit-based billing uses `balance` column debited per-token, auto-reload from Stripe.

See `packages/console/core/src/subscription.ts` for the full implementation.

## OpenClaw Plugin System (Vendored at vendor/openclaw/)

OpenClaw has a mature plugin architecture:

- **137 bundled plugins** in `extensions/`: Telegram, Discord, WhatsApp, Slack, Signal, iMessage, etc.
- **Plugin SDK** (`@openclaw/plugin-sdk`): public API with typed channel/provider/utility contracts
- **Plugin lifecycle**: discovery → manifest loading → registry assembly → activation planning → runtime loading
- **Channel plugins**: implement outbound/inbound/setup/probe/status/security adapters
- **Cron system** (reference): `vendor/openclaw/src/cron/` — full scheduler with delivery to any channel
- **Heartbeat system** (reference): `vendor/openclaw/src/auto-reply/heartbeat.ts`
- **Skills**: 58 SKILL.md files contributed by plugins

## LobeHub System (Vendored at vendor/lobehub/)

LobeHub is a Next.js multi-agent platform with features worth porting:

- **Multi-layer memory**: Activity, Context, Experience, Identity, Preference — 5 layers with LLM extraction
- **Agent Groups**: Multi-agent orchestration with supervisor + parallel execution
- **GraphAgent**: DAG-based agent execution with conditional branching
- **Task Scheduler**: Cron + heartbeat with QStash backend
- **IM Gateway**: Slack, Discord, Telegram, WeChat, QQ, Line, Feishu adapters
- **Skill Store**: Full plugin marketplace with search, categories, one-click install
- **Self-Iteration**: Agent reflection and improvement loops
- **Eval/Benchmark**: Dataset-based evaluation with rubric scoring
- **Daily Brief**: Scheduled AI-generated daily summaries
- **Page Editor**: Collaborative document editing with AI copilot

## Vendored Dependencies

### How to integrate into Agence

Two approaches:
1. **Vendor approach**: Use OpenClaw's plugin SDK and extensions directly via a compatibility layer
2. **Port approach**: Extend Agence's existing `packages/plugin/` with OpenClaw's patterns (channel contracts, cron, heartbeat)

Key files in OpenClaw:
- `vendor/openclaw/packages/plugin-sdk/` — The public plugin SDK
- `vendor/openclaw/extensions/telegram/` — Telegram channel plugin (reference implementation)
- `vendor/openclaw/src/cron/` — Cron/scheduling engine
- `vendor/openclaw/src/plugins/` — Plugin loader, registry, discovery, config
- `vendor/openclaw/src/gateway/` — Message gateway (HTTP + WebSocket)

---

## Dependabot Alerts

33 vulnerabilities inherited from upstream agence.
Core packages patched: minimatch (→10.2.5), turbo (→2.9.14)
Remaining alerts in `enterprise/`, `console/`, `function/` packages (unused).

## Crash Fixes Applied (2026-05-24)

| Issue | Fix |
|---|---|
| Offline drive boot-loop | `project/project.ts` — `Effect.orDie` → `Effect.catch` for sandbox path checks |
| Corrupted database crash | `db.bun.ts` + `db.node.ts` — try/catch with `.corrupted` quarantine + fresh DB |
| Migration loading crash | `db.ts` — try/catch around `readdirSync`/`readFileSync` for migration files |
| Desktop build Vite SSR bug | `todo.ts` — simplified `extractPatterns()` to avoid byte-position corruption in CJS wrapper |

## Critical Chat & Tool Resolution Fixes & Diagnostics System (2026-05-27)

| Issue / Feature | Description & Resolution |
|---|---|
| **JSON Request Parsing Crash** | Fixed critical crash in `domResultRoute` inside `packages/agence/src/server/routes/instance/httpapi/server.ts` by safely parsing raw `request.text` instead of raw body readers, preventing local/API messaging crashes. |
| **KbSearchTool Definition Type-Safety** | Resolved compiler/typecheck blocker in `packages/agence/src/tool/kb-search.ts` by adding explicit generic type parameters `Tool.define<typeof Parameters, { matches: number }, any>()`. |
| **Tool Registry Sanitization** | Commented out incomplete DOM tools (`ExecuteJavascriptTool`, `ClickElementTool`, etc.) in `packages/agence/src/tool/registry.ts` to unblock compilation and prevent internal dependencies leakage. |
| **Effect v4 Configuration Restoral** | Restored original `@opencode-ai/plugin` config module path name in `packages/agence/src/config/config.ts` to allow standard package resolution on boot. |
| **Wiki I/O Safety** | Refactored `loadWikiContext` generator in `packages/agence/src/session/system.ts` to properly handle and swallow file access exceptions using `Effect.tryPromise` rather than invalid inline `try/catch` wrapper. |
| **Startup Diagnostics System** | Implemented `packages/agence/src/server/diagnostics.ts` running at early boot in `server.ts` to dry-run integrity verification on configuration, database connectivity, and Tool Registry initialization with visual terminal cards. |

## Recent incident writeups

- `docs/solutions/prompt-footer-modes-and-memory-ui.md` - prompt footer dropdowns and Memory UI breakages, root causes, fixes, and verification commands.

