# Agence — Project Map

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
│   │       ├── config/          # Config loading (opencconfig.json, multi-source merge)
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
│   │       ├── pages/           # Page components
│   │       ├── components/      # Reusable components
│   │       └── context/         # State management
│   ├── desktop/                 # Electron wrapper
│   │   └── src/
│   │       ├── main/            # Main process (server lifecycle, IPC)
│   │       └── preload/         # Renderer bridge
│   ├── llm/                     # LLM protocol layer
│   ├── ui/                      # Shared UI components
│   ├── plugin/                  # Plugin SDK
│   ├── sdk/                     # External JS SDK + OpenAPI
│   ├── console/                 # Management console
│   ├── web/                     # Marketing/docs site (Astro)
│   ├── enterprise/              # Team sharing portal
│   └── ...                      # 10 more packages
├── vendor/                      # Vendored deps
│   ├── agent-browser/           # Browser automation
│   ├── openclaw/                # Multi-channel messaging
│   └── lobehub/                 # Multi-agent platform
├── scripts/                     # Utility scripts
├── .opencode/                   # Agent config (skills, commands, plugins)
└── infra/                       # SST infrastructure (AWS)
```

## Key Config Paths

| What | Path |
|------|------|
| Global config | `~/.config/agence/opencode.jsonc` |
| Database | `~/.local/share/agence/agence-dev.db` |
| Server logs | `~/.local/share/agence/log/dev.log` |
| Desktop logs | `%APPDATA%/ai.agence.desktop.dev/logs/` |
| Desktop data | `%APPDATA%/ai.agence.desktop.dev/` |
| Project config | `.opencode/opencode.jsonc` |
| Project store | `.git/agence` (project ID cache) |

## Critical Files Cheat Sheet

| Task | File |
|------|------|
| Change app name/paths | `src/core/global.ts` |
| Add MCP server | `.config/agence/opencode.jsonc` → `mcp` field |
| Add tool | `packages/agence/src/tool/` + register in `registry.ts` |
| Add API endpoint | `groups/` + `handlers/` + `api.ts` + `server.ts` |
| Add database table | `*.sql.ts` + `migration/` |
| Change CLI command | `packages/agence/src/cli/cmd/` |
| Change default prompt | `session/prompt/default.txt` |
| Fix desktop issues | `desktop/src/main/sidecar.ts` + `server.ts` |
| Debug startup crashes | Check `InstanceRef` in `effect/instance-state.ts` |
