# Agence documentation

Product-specific docs for the **David Patton / `David2024patton/agence`** fork. Upstream-style user guides still live under `packages/web/src/content/docs/` (inherited from OpenCode); those pages often use **opencode** paths and omit Agence-only features.

## Start here

| Doc | Audience | Contents |
| --- | --- | --- |
| [Getting started](getting-started.md) | New users | Open project → connect provider → chat → hub → learning |
| [Agence vs OpenCode](agence-vs-opencode.md) | Everyone | What stayed the same, what Agence adds, compatibility |
| [OpenCode compatibility](opencode-compatibility.md) | Contributors | Rename pitfalls, headers, config filenames |
| [Project Hub](project-hub.md) | Users | Personas, skills, MCPs, bundles, goals, MCP serve |
| [Learning overview](learning/README.md) | Users + agents | Memory, wiki, heartbeat, desktop settings |

## Learning subsystem

| Doc | Topic |
| --- | --- |
| [Memory](learning/memory.md) | SQLite learnings, layers, auto-capture, maintenance |
| [Knowledge & library](learning/knowledge-and-library.md) | Wiki under `.agence/knowledge/wiki`, `/library` UI |
| [Heartbeat](learning/heartbeat.md) | `HEARTBEAT.md` scheduled tasks |
| [Desktop Learning settings](learning/desktop-settings.md) | Settings → Learning tabs |

## Solutions / incidents

| Doc | Topic |
| --- | --- |
| [Prompt footer modes & memory UI](solutions/prompt-footer-modes-and-memory-ui.md) | Chat modes, `instance-http`, desktop sidecar |

## Architecture (repo root)

- [PROJECT-MAP.md](../PROJECT-MAP.md) — monorepo map and extension guide
- [AGENCE.md](../AGENCE.md) — agent knowledge base (tools, paths, workflow)
- [AGENTS.md](../AGENTS.md) — coding standards and learned workspace facts

## Desktop

- [packages/desktop/README.md](../packages/desktop/README.md) — `bun dev:desktop`, packaging
