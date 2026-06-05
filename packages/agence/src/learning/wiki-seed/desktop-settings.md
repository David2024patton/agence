# Desktop Learning settings

The Agence **desktop app** (`packages/desktop` + `packages/app`) exposes Learning features under **Settings**.

## Open settings

- Gear icon in the sidebar rail, or
- Menu / shortcut (see `packages/app` keybinds)

Pass the **active project** worktree into the dialog so Memory/Knowledge/Heartbeat target the correct repo (not the first project in the list).

## Settings layout

| Section | Tab | Purpose |
| --- | --- | --- |
| **Learning** | **Memory** (sub: Memories, Documents, Knowledge & RAG) | Auto-capture, ingest, wiki overview |
| **Automation** | **Heartbeat** | Edit `HEARTBEAT.md` scheduled tasks |

Scrollbars are visible on long pages (settings use `settings-scrollbar` styling).

## Requirements

1. **Project open** — settings HTTP calls include `directory=<worktree>`. Without a project you see “Open a project first.”
2. **Current sidecar** — Knowledge/Heartbeat need API routes in the bundled server. After pulling repo changes:

   ```powershell
   cd C:\Users\David\AI\agence
   bun dev:desktop
   ```

   `predev` rebuilds `packages/agence/dist/node` loaded by Electron.

3. **Packaged install** — GitHub Release must be **new enough** (Learning APIs added after early 1.16.x). Symptom of old sidecar: `API route … returned HTML instead of JSON`.

## Other desktop differences (vs CLI-only OpenCode)

| Feature | Where |
| --- | --- |
| Projects sidebar | Collapsible; titlebar toggle; default collapsed on launch |
| Knowledge library | Sidebar archive icon → `/library` |
| Chat modes | **build** (full tools) / **plan** (read + web + write plan files only) / **research** (read + web + write reports under `.agence/knowledge/wiki/research/`) |
| Monitor | Menu → `/monitor` |
| External server | Settings → General (connect to remote instance URL) |
| Auto-update | Production builds → `David2024patton/agence` releases |

## Dev vs production

| Mode | Command | Sidecar |
| --- | --- | --- |
| Dev | `bun dev:desktop` (repo root) | Rebuilt on `predev` |
| Packaged | `agence-desktop-win-x64.exe` | Embedded at build time |

If UI changes do not appear, hard-restart Electron and ensure `prebuild` ran before `package:win`.

## Related

- [Memory](memory.md)
- [Knowledge & library](knowledge-and-library.md)
- [Heartbeat](heartbeat.md)
- [Agence vs OpenCode](../agence-vs-opencode.md)
