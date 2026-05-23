# Agence Knowledge Base

Project: **Agence** — Modular agent + MCP server framework by David Patton
Forked from: [anomalyco/opencode](https://github.com/anomalyco/opencode)
Private repo: `github.com/David2024patton/agence`
Upstream: `github.com/anomalyco/opencode` (original opencode)

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
  opencode/       — CLI + server + tools + agent loop
  app/            — SolidJS web UI
  desktop/        — Electron wrapper
  core/           — Shared: filesystem, global paths, models-dev
  ui/             — Shared UI components (SolidJS)
  sdk/js/         — TypeScript SDK for REST API
  plugin/         — Plugin type definitions
  llm/            — LLM event types
```

### Key architectural patterns
- **Effect Services:** Every subsystem is an Effect `Context.Service` with Tag, Interface, layer, and defaultLayer
- **InstanceState:** Per-project state via ScopedCache; auto-cleaned on project close
- **Tool Registry:** All tools defined via `Tool.define(id, Effect.gen(...))` and registered in `tool/registry.ts`
- **Session Processor:** Agent loop in `session/processor.ts` streams LLM events → tool calls → results
- **Config:** `opencode.json` / `opencode.jsonc` — global at `~/.config/agence/`, project-level

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

## Config Paths (Rebranded from opencode)

| Directory | Old path | New path |
|-----------|----------|----------|
| Config | `~/.config/opencode/` | `~/.config/agence/` |
| Data | `~/.local/share/opencode/` | `~/.local/share/agence/` |
| Cache | `~/.cache/opencode/` | `~/.cache/agence/` |
| State | `~/.local/state/opencode/` | `~/.local/state/agence/` |
| Desktop app ID | `ai.opencode.desktop` | `ai.agence.desktop` |
| Protocol scheme | `opencode://` | `agence://` |
| Settings store | `opencode.settings` | `agence.settings` |

Env var override: `AGENCE_CHANNEL=dev|beta|prod` (was `OPENCODE_CHANNEL`)

---

## Key Files We Modified

### Tools
- `packages/opencode/src/tool/todo.ts` — Full task system (todowrite, todoread, task_search, todo_carry, reflect, model_learn, quality_gate)
- `packages/opencode/src/tool/browser.ts` — Browser automation (inspect, tutorial, extract, analyze, screenshot, close)
- `packages/opencode/src/tool/screenshot.ts` — Desktop screenshot
- `packages/opencode/src/tool/powershell.ts` — PowerShell tool
- `packages/opencode/src/tool/weather.ts` — Weather via wttr.in
- `packages/opencode/src/tool/system_info.ts` — System info
- `packages/opencode/src/tool/drives.ts` — Drive listing
- `packages/opencode/src/tool/os_open.ts` — Open files
- `packages/opencode/src/tool/env_read.ts` / `env_write.ts` — Env var management
- `packages/opencode/src/tool/lint.ts` — Multi-language linting
- `packages/opencode/src/tool/image_describe.ts` — Image OCR/vision
- `packages/opencode/src/tool/registry.ts` — Tool registration

### Core Systems
- `packages/opencode/src/session/todo.ts` — Todo service with history, search, carry
- `packages/opencode/src/session/session.sql.ts` — DB schema (TodoTable, TaskHistoryTable)
- `packages/opencode/src/session/message-v2.ts` — Vision model detection + image stripping
- `packages/opencode/src/provider/provider.ts` — Local provider auto-discovery + database entries
- `packages/opencode/src/provider/local-providers.ts` — Port probing logic
- `packages/opencode/src/storage/json-migration.ts` — Migration fix for new schema
- `packages/core/src/global.ts` — App path changed from "opencode" to "agence"

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
- `packages/opencode/migration/20260523164657_add_todo_id_description_parent/` — Todo: id, description, parentId
- `packages/opencode/migration/20260523171744_add_task_deps_tags_history/` — Todo: dependsOn, tags + TaskHistoryTable

---

## Running

```powershell
cd C:\Users\David\AI\smart-hub\opencode01

# Build node server (required before desktop dev)
bun run --cwd packages/opencode script/build-node.ts

# Desktop dev mode
bun dev:desktop

# CLI dev mode (terminal TUI)
bun run --cwd packages/opencode dev

# Serve mode (REST API)
.\packages\opencode\dist\opencode-windows-x64\bin\opencode.exe serve --port 9123

# Typecheck
bun run --cwd packages/opencode typecheck
```

---

## Git Workflow

```powershell
# Push to private repo
git push origin dev --no-verify

# Pull upstream opencode changes
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
- `packages/console/app/` — SolidStart web app (opencode.ai)
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

---

## Dependabot Alerts

33 vulnerabilities inherited from upstream opencode.
Core packages patched: minimatch (→10.2.5), turbo (→2.9.14)
Remaining alerts in `enterprise/`, `console/`, `function/` packages (unused).
