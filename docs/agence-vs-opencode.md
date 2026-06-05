# Agence vs OpenCode

Agence is a **private fork and extension** of [anomalyco/opencode](https://github.com/anomalyco/opencode). Most of the core product (CLI, TUI, session loop, providers, MCP, plugins, SDK shape) is shared. Agence adds **project-first agent scoping** (no chat without an open project folder), **project-scoped learning**, a richer **desktop app**, and David-specific **tools** and **release** workflow.

> New users: start with [getting-started.md](getting-started.md).

## Relationship at a glance

```text
OpenCode (upstream)          Agence (this repo)
──────────────────          ──────────────────
CLI + TUI                   Same + custom tools
HTTP instance API           Same + Memory / Knowledge / Library / Heartbeat APIs
Solid web UI (optional)     packages/app (desktop + dev web)
Electron desktop            packages/desktop (sidecar bundles agence)
opencode.json(c)            Still used (by design)
.opencode/skills            Still used (by design)
~/.config/opencode/         ~/.config/agence/ (rebranded data paths)
```

**Upstream pull:** `git pull upstream dev` (see [AGENCE.md](../AGENCE.md)).

**Private releases:** Windows desktop builds on `David2024patton/agence` (GitHub Releases).

## What is largely the same as OpenCode

| Area | Notes |
| --- | --- |
| Agent loop | Session processor, tool registry, permissions |
| Providers | 75+ providers, local discovery (Ollama, LM Studio, vLLM, etc.) |
| MCP | Configure in `opencode.jsonc` → `mcp` |
| Skills | `.opencode/skills/*/SKILL.md` auto-discovery |
| Config merge | Global + project `opencode.json(c)` |
| SDK / headers | `x-opencode-directory`, `createOpencodeClient` naming kept for compatibility |
| TUI | `packages/agence` CLI TUI |
| Monitor | `/monitor/state` + `/monitor` page (reference implementation in PROJECT-MAP) |

## What Agence adds (not in stock OpenCode docs)

### 1. Memory intelligence (SQLite + settings)

- **Stored learnings** in the project database with layers (`activity`, `context`, `experience`, `identity`, `preference`), tags, decay, and optional **global** scope (`__global__`).
- **Auto-capture** from chat (preferences, corrections, tool failures) with tunable sensitivity.
- **Maintenance:** consolidate near-duplicates, prune stale/redundant rows, optional JSON export.
- **Settings:** Desktop → **Settings → Learning → Memory** (and session memory panel).
- **API:** `/memory/state`, `/memory/list`, `/memory/settings`, `/memory/maintenance`, `/memory/export`, `/memory/delete`.

See [learning/memory.md](learning/memory.md).

### 2. Knowledge wiki (files, not vectors)

- Long-form markdown articles under **`{project}/.agence/knowledge/wiki/`** with `[[wiki links]]` and backlinks.
- **Raw archives** under `.agence/knowledge/raw/` from session compaction.
- **Library UI:** sidebar **Knowledge** (archive icon) → `/library`.
- **Settings:** **Knowledge base** tab lists articles and opens the library.
- **API:** `/library/list`, `/knowledge/state` (newer sidecars).

Distinct from **Memory** (short ranked facts for prompts).

See [learning/knowledge-and-library.md](learning/knowledge-and-library.md).

### 3. Heartbeat (scheduled background tasks)

- Project file **`HEARTBEAT.md`** at repo root (checkbox lines: active `[ ]`, paused `[x]`).
- Run history in **`.agence/heartbeat.json`**.
- Built-in actions: `fn:memory-maintenance`, `fn:memory-export`, `fn:memory-ingest-doc <path>`, plus `cmd:` and free-form agent prompts.
- **Settings:** **Settings → Learning → Heartbeat**.
- **API:** `/library/heartbeat/*` or `/heartbeat/*` depending on sidecar age.

See [learning/heartbeat.md](learning/heartbeat.md).

### 4. Desktop UX (Agence app)

| Feature | OpenCode typical | Agence desktop |
| --- | --- | --- |
| Learning settings | N/A | Settings → Learning (Memory, Knowledge, Heartbeat) |
| Knowledge browser | N/A | `/library` + sidebar icon |
| Projects sidebar | Varies | Collapsible rail, titlebar toggle, launch collapsed |
| Chat modes | build / plan | **build**, **plan**, **research** (research restricts edit/shell/task tools) |
| Memory panel | N/A | Session UI + titlebar memory control |
| External server | Uncommon in docs | Settings → connect to remote instance |
| Updates | N/A | `electron-updater` → GitHub Releases |

See [learning/desktop-settings.md](learning/desktop-settings.md).

### 5. Extra tools (examples)

Agence ships many tools beyond a minimal OpenCode install. Highlights (see [AGENCE.md](../AGENCE.md) for full list):

- Browser automation (`browser_*`, agent-browser)
- Desktop: `screenshot`, `powershell`
- System: `weather`, `drives`, `system_info`, `env_read` / `env_write`, `lint`
- Learning-adjacent: `reflect`, `model_learn`, `quality_gate`, extended **todo** system
- Image: `image_describe` + vision stripping for non-vision models

### 6. Vendored / reference code

- `vendor/agent-browser` — browser CLI
- `vendor/openclaw` — messaging plugins (reference for gateway/heartbeat patterns)
- `vendor/lobehub` — multi-agent reference

## Documentation map

| You want… | Read… |
| --- | --- |
| Fork vs upstream | This file + [opencode-compatibility.md](opencode-compatibility.md) |
| Add an API route | [PROJECT-MAP.md](../PROJECT-MAP.md) (Monitor example) |
| Memory / wiki / heartbeat | [learning/](learning/README.md) |
| Run desktop dev | [packages/desktop/README.md](../packages/desktop/README.md) |
| End-user install (CLI) | [README.md](../README.md) + `packages/web` docs (verify paths) |

## Version note

Desktop releases are versioned in `packages/desktop/package.json` (e.g. **v1.16.5+**). Learning APIs and Settings → Learning require a **current sidecar** (`bun dev:desktop` runs `predev` to rebuild `packages/agence/dist/node`). Older installers may show Memory but fail Knowledge/Heartbeat with “HTML instead of JSON” until upgraded.
