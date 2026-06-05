# Learning subsystem

Agence separates **three kinds of “memory”** that OpenCode does not document as a single system:

| Kind | Storage | Purpose | UI |
| --- | --- | --- | --- |
| **Memory** | SQLite (per project DB) | Short learnings injected into prompts | Settings → Memory, session memory panel |
| **Knowledge** | Markdown wiki files | Long-form articles, browsable library | Settings → Knowledge, `/library` |
| **Heartbeat** | `HEARTBEAT.md` + JSON runs | Scheduled background maintenance | Settings → Heartbeat |

```text
{project}/
  HEARTBEAT.md
  .agence/
    memory-settings.json
    memory-export.json          (optional, after maintenance)
    heartbeat.json
    knowledge/
      wiki/*.md                 [[wikilinks]]
      raw/*.md                  archived conversations
```

All paths are **per open project** (workspace `directory`), not your user profile folder.

**Agent chat, personas, skills, and MCPs** only load inside a project. The sidecar rejects instance API calls without `directory` or `x-opencode-directory` (no silent fallback to the process working directory). Open a project from Home or the sidebar before starting a session.

## Desktop entry points

**Settings → Learning**

- **Memory** — capture toggles, maintenance, recent learnings list
- **Knowledge base** — wiki path, article count, open library
- **Heartbeat** — edit scheduled tasks, create default file

Requires a **project to be open** (settings use the active project worktree).

**Sidebar**

- **Knowledge** (archive icon) → full wiki browser at `/library`

## HTTP APIs (instance)

Registered on `InstanceHttpApi` (see `packages/agence/src/server/routes/instance/httpapi/api.ts`):

| Group | Paths |
| --- | --- |
| Memory | `/memory/state`, `/memory/list`, `/memory/settings`, … |
| Knowledge | `/knowledge/state`, `/knowledge/list` |
| Library | `/library/list`, `/library/heartbeat/state`, … |
| Heartbeat | `/heartbeat/state`, `/heartbeat/save`, `/heartbeat/init` |

The desktop app often calls these via `instanceHttpRequest` (`packages/app/src/utils/instance-http.ts`) with `?directory=` and `x-opencode-directory`.

## Code map

| Area | Path |
| --- | --- |
| Memory intelligence | `packages/agence/src/learning/memory-intelligence.ts` |
| Memory settings file | `packages/agence/src/learning/memory-settings.ts` |
| Wiki listing | `packages/agence/src/learning/wiki.ts`, `knowledge-paths.ts` |
| Archive → wiki/raw | `packages/agence/src/learning/archive.ts` |
| Heartbeat runner | `packages/agence/src/background/heartbeat.ts` |
| App settings UI | `packages/app/src/components/settings-*.tsx` |
| Learning HTTP helpers | `packages/app/src/utils/learning-settings-api.ts` |

## Docs in this folder

- [memory.md](memory.md)
- [knowledge-and-library.md](knowledge-and-library.md)
- [heartbeat.md](heartbeat.md)
- [desktop-settings.md](desktop-settings.md)

Compare with upstream: [Agence vs OpenCode](../agence-vs-opencode.md).
