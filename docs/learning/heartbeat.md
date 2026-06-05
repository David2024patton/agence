# Heartbeat scheduled tasks

**Heartbeat** runs background work on a schedule while a project is active. Tasks are declared in the project root file **`HEARTBEAT.md`**.

## File format

```markdown
# Heartbeat

Background tasks for this project. Use `- [ ]` for active tasks and `- [x]` to pause.

- [ ] Every 1d: memory-maintenance | fn:memory-maintenance
- [x] Every 6h: old-task | fn:memory-export
```

| Part | Meaning |
| --- | --- |
| `[ ]` / `[x]` | Active / paused |
| `Every 15m` / `1h` / `1d` | Interval (`m`, `h`, `d`) |
| `task-name` | Identifier (used in `.agence/heartbeat.json`) |
| After `\|` | Action (see below) |

## Run history

```text
.agence/heartbeat.json
```

Maps `taskName` → last run timestamp (ms).

## Built-in actions

| Prompt | Action |
| --- | --- |
| `fn:memory-maintenance` | Memory consolidate/prune for project |
| `fn:memory-export` | Export memories to `.agence/memory-export.json` |
| `fn:memory-ingest-doc path/to/doc.md` | Ingest a markdown doc into memory |
| `cmd: …` | Shell command |
| *(anything else)* | Short agent session with that prompt |

Parser: `packages/agence/src/background/heartbeat.ts`

## Settings UI

**Settings → Learning → Heartbeat**

- Shows path `HEARTBEAT.md` (project root)
- Lists tasks with last run / next run hints
- Add task presets (maintenance, export, ingest doc)
- **Create default file** if missing

Saving posts to `/library/heartbeat/save` or `/heartbeat/save` (sidecar-dependent).

## Scheduler

Background loop checks roughly **every 30 seconds** while the project/instance is open (desktop sidecar). Paused lines (`[x]`) are skipped.

## HTTP API

| Method | Path |
| --- | --- |
| GET | `/heartbeat/state` or `/library/heartbeat/state` |
| POST | `/heartbeat/save` or `/library/heartbeat/save` |
| POST | `/heartbeat/init` or `/library/heartbeat/init` |

Older packaged sidecars may only support file read via `/file/content`; upgrade sidecar for full settings editing.

## OpenCode / OpenClaw

OpenCode upstream does not document `HEARTBEAT.md`. Agence took inspiration from **OpenClaw-style** cron/heartbeat patterns in `vendor/openclaw` but implements a **simpler markdown checklist** tied to Agence memory functions.
