# Knowledge wiki and library

**Knowledge** is a **file-based wiki** inside each project. Articles are markdown files with optional `[[wiki links]]` and computed backlinks.

## Layout

Canonical paths (see `packages/agence/src/learning/knowledge-paths.ts`):

```text
.agence/knowledge/
  wiki/           ← *.md articles (primary)
  raw/            ← archived conversation markdown
  memory.md       ← optional summary (archive pipeline)
```

Display path in UI: **`.agence/knowledge/wiki`**

### Legacy layout

Older experiments may have `*.md` directly under `.agence/knowledge/` (without `wiki/`). The server **also lists** those files when scanning, but new content should go under **`wiki/`**.

### Wrong location (common mistake)

If settings show something like `C:\Users\YourName\.agence\knowledge`, the app was pointed at the **wrong project directory** (e.g. user home as workspace). Open the real repo as a project and check again.

## vs Memory (SQLite)

| | Knowledge wiki | Memory |
| --- | --- | --- |
| Format | Markdown files | Database rows |
| Best for | Long docs, indexes, architecture notes | Preferences, corrections, short facts |
| Browse | `/library` page | Memory panel / list API |
| Agent | `kb_search`, system prompt wiki hint | Auto-capture + recall in prompt |

## Library UI

- **Route:** `/library?directory=<encoded-worktree>`
- **Sidebar:** bottom **Knowledge** button (archive icon)
- Renders markdown with wiki link navigation

Code: `packages/app/src/pages/library.tsx`

## Settings → Knowledge base

Shows:

- Project-relative wiki path
- Article count and file list (names + link counts)
- **Open library** button

Uses `/library/list` or `/knowledge/state` depending on sidecar version (`learning-settings-api.ts` fallbacks).

## HTTP API

| Method | Path | Response |
| --- | --- | --- |
| GET | `/library/list` | `{ path, files: [{ name, content, links, backlinks }] }` |
| GET | `/knowledge/state` | Summary + files (newer sidecars) |

## How articles get created

- **Archive pipeline** — `packages/agence/src/learning/archive.ts` writes `raw/` and can upsert `wiki/` pages from session summaries
- **Agent** — edits markdown under `.agence/knowledge/wiki/` (system prompt mentions wiki + `kb_search` when tools enabled)
- **Manual** — add `my-topic.md` yourself

## Wiki link syntax

```markdown
See [[agence architecture]] for the monorepo map.
```

Slugs are normalized (lowercase, spaces → hyphens). Backlinks appear in API/list responses.

## OpenCode comparison

OpenCode ecosystem docs may mention plugins like “memory-wiki” in `vendor/openclaw` references. Agence ships a **first-party** wiki path and desktop library without requiring that plugin stack.
