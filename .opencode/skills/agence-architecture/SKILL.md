---
name: agence-architecture
description: Complete architecture and extension guide for the Agence project. Use whenever working on this codebase, adding features, debugging, or understanding how the monorepo is structured. Covers the opencode→agence rename, all extension points, config paths, Effect layer system, debugging, and the full project tree.
---

# Agence Architecture & Extension Guide

## Quick Reference
- **Repo:** `C:\Users\David\AI\agence` / `github.com/David2024patton/agence` (branch: `dev`)
- **Launch:** `cd C:\Users\David\AI\agence && bun dev:desktop`
- **Build server:** `cd packages/agence && bun run script/build-node.ts`
- **Run tests:** `cd packages/<name> && bun test` (NEVER from root)

## Architecture Tree

```
agence/                          # Monorepo root (Bun workspaces)
├── packages/
│   ├── agence/                  # CORE: CLI + server + agent + tools
│   │   └── src/
│   │       ├── agent/           # Agent system (prompts, subagent permissions)
│   │       ├── bus/             # In-process event bus (PubSub with InstanceState)
│   │       ├── cli/cmd/tui/     # Terminal UI (SolidJS-based)
│   │       ├── config/          # Config loading (multi-source merge, well-known URLs)
│   │       │   ├── config.ts    # Main config schema, loadInstanceState
│   │       │   └── directories.ts # Self-contained dir config (baseDir, mcp, skills, tools)
│   │       ├── effect/          # Effect runtime integration
│   │       │   ├── app-runtime.ts    # ManagedRuntime with ALL service layers
│   │       │   ├── instance-state.ts # Per-project scoped state cache (ScopedCache)
│   │       │   │   Key: context, directory, workspaceID, make, get, use, has, invalidate
│   │       │   └── instance-ref.ts   # InstanceRef/WorkspaceRef (Context.Reference)
│   │       ├── learning/        # Memory/learning system
│   │       │   ├── index.ts         # storeLearning, searchLearnings, getEmbedding
│   │       │   ├── learning.sql.ts  # learning + embedding_cache tables
│   │       │   └── archive.sql.ts   # conversation_archive table
│   │       ├── mcp/             # MCP server/client (Model Context Protocol)
│   │       ├── permission/      # Permission evaluation
│   │       ├── plugin/          # Plugin system (provider plugins)
│   │       ├── project/         # Project management (VCS, bootstrap)
│   │       │   ├── instance-store.ts  # Per-directory instance lifecycle
│   │       │   └── instance-layer.ts  # InstanceStore + InstanceBootstrap layer
│   │       ├── provider/        # AI provider abstraction (75+ providers)
│   │       ├── pty/             # Pseudo-terminal integration
│   │       ├── server/          # HTTP/WebSocket server (Effect HttpApi)
│   │       │   └── routes/instance/httpapi/
│   │       │       ├── groups/  # API endpoint definitions (22 groups)
│   │       │       ├── handlers/# API implementations
│   │       │       └── middleware/ # Auth, instance-context, workspace-routing, error
│   │       ├── session/         # Session management
│   │       │   ├── compaction.ts # Context overflow → structured summary
│   │       │   ├── prompt/      # 15 prompt templates (default.txt, gpt.txt, etc.)
│   │       │   └── session.sql.ts # 7 session tables
│   │       ├── skill/           # Skill system (SKILL.md discovery)
│   │       ├── storage/         # SQLite database (Drizzle ORM, 24 migrations)
│   │       │   └── db.ts        # getChannelPath, getPath, Client singleton
│   │       └── tool/            # 50+ tools (registry.ts for registration)
│   │           ├── agent.ts     # memory_add, memory_recall, agent_group
│   │           ├── todo.ts      # todowrite, todoread, model_learn, quality_gate
│   │           ├── browser.ts   # 6 browser automation tools
│   │           └── registry.ts  # Tool registration (import + add to list)
│   └── core/                    # @agence-ai/core: shared library
│       └── src/global.ts        # XDG paths (data/config/cache/state/log/tmp)
├── app/                         # Web UI (SolidJS SPA)
│   └── src/
│       ├── pages/               # Page components (home, session, monitor)
│       │   └── monitor.tsx      # Monitor dashboard
│       ├── components/session/  # Session components
│       │   ├── session-context-tab.tsx  # Context panel (stats, breakdown)
│       │   └── memory-panel.tsx        # Memory panel (search, archive browse)
│       └── context/             # State management
├── desktop/                     # Electron wrapper
│   └── src/main/
│       ├── sidecar.ts           # Sidecar process (imports virtual:agence-server)
│       ├── server.ts            # Sidecar lifecycle + health check
│       └── index.ts             # App entry, needsMigration check
├── vendor/                      # Git submodules
│   ├── agent-browser/           # Browser automation (CDP)
│   ├── openclaw/                # 137 messaging plugins
│   └── lobehub/                 # Multi-agent platform
├── .opencode/skills/            # Auto-discovered skills
└── .opencode/command/           # Custom agent commands
```

## Key Config Paths

| What | Path |
|------|------|
| Global config | `~/.config/agence/opencode.jsonc` |
| Database (dev) | `~/.local/share/agence/agence-dev.db` |
| Database (prod) | `~/.local/share/agence/agence.db` |
| Server logs | `~/.local/share/agence/log/dev.log` |
| Desktop logs | `%APPDATA%/ai.agence.desktop.dev/logs/` |
| Project config | `.opencode/opencode.jsonc` |
| Project store | `.git/agence` (falls back to `.git/opencode`) |

## Extension Points — How to Add Features

### Level 1: Fully Modular (add 1 file, auto-discovered)

| Feature | How | Example |
|---------|-----|---------|
| **Tool** | `src/tool/mytool.ts` + register in `registry.ts` | `browser.ts`, `weather.ts` |
| **MCP Server** | Add to `~/.config/agence/opencode.jsonc` → `mcp` field | `desktop-commander` |
| **Skill** | Drop `SKILL.md` in `.opencode/skills/<name>/` | `tool-tester/SKILL.md` |
| **Provider Plugin** | File in `core/src/plugin/provider/` + register in `index.ts` | `openai.ts`, `groq.ts` |
| **Custom Command** | Drop `.md` in `.opencode/command/` | `deploy.md` |
| **Desktop Menu** | Add to `packages/app/src/desktop-menu.ts` | Monitor menu item |
| **Config Section** | `src/config/myconfig.ts` + add to `config.ts` Info struct | `directories.ts` |

### Level 2: Follow a Pattern (add 2-3 files)

| Feature | Files | Registration |
|---------|-------|-------------|
| **API Endpoint** | 1. `groups/myfeature.ts` 2. `handlers/myfeature.ts` | 3. `api.ts` + `server.ts` |
| **CLI Command** | 1. `cli/cmd/mycommand.ts` | 2. `src/index.ts` |
| **Database Table** | 1. `*.sql.ts` 2. `migration/<ts>_<name>/migration.sql` | Auto-applied |
| **UI Page** | 1. `app/src/pages/mypage.tsx` | 2. `app.tsx` route |
| **Effect Service** | 1. `src/myfeature/index.ts` | 2. `app-runtime.ts` + `server.ts` |

### Real Example: The Monitor Feature

```
1. groups/monitor.ts         — API definition (MonitorApi)
2. handlers/monitor.ts       — Implementation (stateHandler + eventStream)
3. pages/monitor.tsx         — GUI dashboard
4. api.ts + server.ts        — Registration (~3 lines each)
5. app.tsx                   — Route (~2 lines)
6. desktop-menu.ts           — Menu item (~2 lines)
Total: 3 new files, ~10 lines of registration
```

## Effect Layer System

- Every service is a `Context.Service` + `Layer.effect`
- `AppLayer` (in `app-runtime.ts`) provides ALL services
- Per-project state via `InstanceState` (ScopedCache keyed by directory)
- `InstanceRef` requires a fallback at server startup (middleware provides real value per-request)
- `Effect.fn` for traced effects, `Effect.fnUntraced` for internal helpers
- `Effect.orDie` converts errors to defects (unrecoverable)

## Compaction System

When context exceeds model limits:
1. `compaction.ts` detects overflow via `isOverflow()`
2. LLM summarizes conversation into structured template (Goal → Progress → Decisions → Next Steps)
3. Summary replaces old messages, preserving recent 2 turns + up to 8000 tokens
4. New `conversation_archive` table auto-stores summaries for later search/recall

## Debugging

| Method | How |
|--------|-----|
| Sidecar log level | `$env:AGENCE_LOG_LEVEL="DEBUG"; bun dev:desktop` |
| Desktop DevTools | `Ctrl+Shift+I` in Electron window |
| Health check | `GET /global/health` |
| Live events | `GET /event` (SSE) |
| Monitor state | `GET /monitor/state` (JSON) |
| Monitor feed | `GET /monitor/events` (SSE) |
| Server log | `~/.local/share/agence/log/dev.log` |

## OpenCode → Agence Rename (Key Patterns)

When renaming in this codebase, these patterns caused bugs:
- `opencode/` in user-agent/db filenames — regex protected `/` and `-`
- `~opencode/InstanceRef` — protected by `~` prefix
- `Effect.tryPromise({try, catch})` — Effect v4 object form needs catch in options
- `export { workspaceID }` — accidentally removed during edit revert
- Comment lines replacing `import` lines — NEVER replace line 1 of a file
