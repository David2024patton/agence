# Memory (SQLite learnings)

**Memory** stores ranked, structured learnings in the **project SQLite database**. The agent recalls them during prompts (including cross-project **global** preferences when enabled).

This is **not** the wiki under `.agence/knowledge/wiki/` — see [knowledge-and-library.md](knowledge-and-library.md).

## Layers

| Layer | Typical content |
| --- | --- |
| `activity` | What happened in sessions |
| `context` | Project facts |
| `experience` | How-to / patterns |
| `identity` | Who the user is |
| `preference` | Style and choices |

Tags (e.g. `UI`, `workflow`) further categorize rows. **Decay** scores affect ranking over time.

## Global scope

Learnings can be **project** or **global** (`scope: global`). Global rows use project id `__global__` and can be included in prompts when **Global memories in prompts** is enabled.

## Settings file

Per project:

```text
.agence/memory-settings.json
```

Fields (see `packages/agence/src/learning/memory-settings.ts`):

| Setting | Default | Meaning |
| --- | --- | --- |
| `autoCaptureEnabled` | true | Master switch for automatic capture |
| `capturePreferences` | true | “prefer / always / never” style phrases |
| `captureCorrections` | true | User corrections to the assistant |
| `captureToolFailures` | true | Repeated tool/command failures |
| `minAutoImportance` | `low` | `low` / `medium` / `high` — higher = fewer captures |
| `globalRecall` | true | Pull global learnings into recall |
| `autoConsolidate` | true | Merge near-duplicates after sessions |
| `autoPruneStale` | true | Drop low-decay auto-captured rows |
| `autoPruneRedundant` | true | Drop very similar duplicates |
| `exportOnMaintenance` | false | Write `.agence/memory-export.json` after maintenance |

Toggles in **Settings → Learning → Memory** POST to `/memory/settings`.

## HTTP API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/memory/state` | Settings + stats + recent items |
| GET | `/memory/list` | List learnings (`layer`, `limit`, `includeGlobal`) |
| POST | `/memory/settings` | Update settings JSON |
| POST | `/memory/maintenance` | Consolidate + prune (respects settings flags) |
| POST | `/memory/export` | Export JSON snapshot |
| POST | `/memory/delete` | Delete by ids |

Query: `directory` (and optional `workspace`) — see workspace routing middleware.

## UI

- **Settings → Learning → Memory** — full control surface
- **Session memory panel** — browse/search learnings; link to settings
- **Titlebar** — quick access to memory panel (when session active)

## Agent tools

Memory is also influenced by session tools such as `reflect`, `model_learn`, and `quality_gate` (skills/concepts), which are separate from the SQLite memory table but complementary.

## Maintenance workflow

1. Open project in desktop app.
2. Settings → Memory → run maintenance (or enable auto flags).
3. Optionally export JSON for external sync / backup.

Ingest from docs (development):

```bash
cd packages/agence
bun scripts/ingest-fixes-doc.ts
```

(Used to load `docs/solutions/*.md` patterns into memory — see script for paths.)

## OpenCode comparison

Stock OpenCode docs describe skills and session history, not this **SQLite memory intelligence** layer or the Memory settings UI. Upstream may add similar features later; this fork’s source of truth is `packages/agence/src/learning/`.
