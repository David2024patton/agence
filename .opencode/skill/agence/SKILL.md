---
name: agence
description: Complete architecture, extension guide, UI patterns, and fix knowledge base for the Agence project. Use whenever working on this codebase — adding features, debugging, understanding the monorepo structure, or modifying the desktop UI.
---

# Agence Skill

## Quick Reference
- **Repo:** `C:\Users\David\AI\agence` / `github.com/David2024patton/agence` (branch: `dev`)
- **Launch:** `cd C:\Users\David\AI\agence && bun dev:desktop`
- **Build server:** `cd packages/agence && bun run script/build-node.ts`
- **Run tests:** `cd packages/<name> && bun test` (NEVER from root)
- **Kill stale processes:** `Get-Process -Name "electron","node" | Stop-Process -Force; Start-Sleep 2`

## Architecture Tree

```
agence/                          # Monorepo root (Bun workspaces)
├── packages/
│   ├── agence/                  # CORE: CLI + server + agent + tools
│   │   └── src/
│   │       ├── agent/           # Agent system
│   │       ├── bus/             # In-process event bus (PubSub with InstanceState)
│   │       ├── config/          # Config loading
│   │       │   ├── config.ts    # Main config schema, loadInstanceState
│   │       │   └── directories.ts # Self-contained dir config
│   │       ├── effect/          # Effect runtime integration
│   │       │   ├── app-runtime.ts    # ManagedRuntime with ALL service layers
│   │       │   ├── instance-state.ts # Per-project scoped state cache
│   │       │   └── instance-ref.ts   # InstanceRef/WorkspaceRef
│   │       ├── learning/        # Memory/learning system
│   │       │   ├── index.ts         # storeLearning, searchLearnings, getEmbedding
│   │       │   ├── learning.sql.ts  # learning + embedding_cache tables
│   │       │   └── archive.sql.ts   # conversation_archive table (24th migration)
│   │       ├── server/          # HTTP/WebSocket server
│   │       │   └── routes/instance/httpapi/
│   │       │       ├── groups/       # API endpoint definitions
│   │       │       ├── handlers/     # API implementations
│   │       │       └── middleware/   # Auth, instance-context, workspace-routing
│   │       ├── session/         # Session management
│   │       │   └── compaction.ts # Auto-compacts on overflow
│   │       ├── storage/         # SQLite database (24 migrations)
│   │       └── tool/            # 50+ tools (registry.ts for registration)
│   ├── core/                    # @agence-ai/core
│   │   └── src/global.ts        # XDG paths
│   ├── app/                     # Web UI (SolidJS SPA)
│   │   └── src/
│   │       ├── pages/
│   │       │   ├── session/session-side-panel.tsx  # Side panel (context, memory, review tabs)
│   │       │   └── monitor.tsx           # Monitor dashboard
│   │       ├── components/
│   │       │   ├── titlebar.tsx          # Window titlebar (status, memory, settings, help icons)
│   │       │   ├── session/session-header.tsx  # Session header (status, terminal, review, filetree)
│   │       │   └── session/memory-panel.tsx    # Memory panel (search, archive browse)
│   │       └── index.css               # Global CSS (includes hideCloseButton fix)
│   └── desktop/                 # Electron wrapper
│       └── src/main/
│           ├── sidecar.ts       # Sidecar (imports virtual:agence-server)
│           ├── server.ts        # Sidecar lifecycle + health check
│           ├── windows.ts       # Window creation (frame: false, titleBarStyle: hidden)
│           └── index.ts         # App entry, needsMigration check
├── vendor/                      # Git submodules
├── .opencode/skills/            # Auto-discovered skills
└── PROJECT-MAP.md               # Full project map
```

## Key Config Paths

| What | Path |
|------|------|
| Global config | `~/.config/agence/opencode.jsonc` |
| Database (dev) | `~/.local/share/agence/agence-dev.db` |
| Server logs | `~/.local/share/agence/log/dev.log` |
| Desktop logs | `%APPDATA%/ai.agence.desktop.dev/logs/` |
| Project store | `.git/agence` (falls back to `.git/opencode`) |

## UI Component Map — Where Icons Live

```
Desktop Window (Electron, frame:false, titleBarStyle:hidden)
├── Titlebar (titlebar.tsx) ← StatusPopover, memory, settings, help icons
│   └── Native minimize/maximize/close buttons on the right
├── Session Header (session-header.tsx) ← Status, memory, terminal, review, filetree, settings, help
│   └── Only visible inside a session page
├── Session Side Panel (session-side-panel.tsx) ← Review, context, memory, file tabs
│   ├── Tab triggers: Review | Memory | Context | [file tabs...] | [+]
│   └── Tab content panels: MemoryPanel, SessionContextTab, FileTabContent
└── Sidebar (layout context) ← Project list, sessions, settings gear, help ? at bottom
```

### Titlebar Icons (native frame area, next to minimize button)

| Icon | Component | File |
|------|-----------|------|
| Status dot | StatusPopover | `components/status-popover.tsx` |
| Memory (archive) | IconButton → CustomEvent | `components/titlebar.tsx:472` |
| Settings gear | IconButton | `components/titlebar.tsx` |
| Help (?) | IconButton | `components/titlebar.tsx` |

### Session Header Icons (below titlebar, session page only)

| Icon | How it toggles |
|------|---------------|
| Status | StatusPopover |
| Memory | `tabs().open("memory")` |
| Terminal | `view().terminal.toggle()` |
| Review | `view().reviewPanel.toggle()` |
| File tree | `layout.fileTree.toggle()` |
| Settings | `layout.settings` |
| Help | Opens GitHub page |

## How to Add Titlebar Icons (Step-by-Step)

Titlebar is the top bar where minimize/maximize/close live. The status dot is there at `titlebar.tsx` line 472.

```tsx
// 1. Find the StatusPopover section in titlebar.tsx (~line 468-476)
<Show when={currentSessionTab()?.dir} keyed>
  {(dir) => (
    <SDKProvider directory={dir}>
      <Tooltip placement="bottom" value={language.t("status.popover.trigger")}>
        <StatusPopover />
      </Tooltip>
    </SDKProvider>
  )}
</Show>

// 2. Add your icon AFTER this block
<Show when={currentSessionTab()?.dir}>
  <Tooltip placement="bottom" value="Memory">
    <IconButton icon="archive" variant="ghost" size="small"
      class="titlebar-icon w-6 h-6"
      onClick={() => window.dispatchEvent(new CustomEvent("agence:memory:toggle"))}
      aria-label="Memory" />
  </Tooltip>
</Show>
```

**Cross-component communication:** The titlebar doesn't share session context, so use `window.dispatchEvent(new CustomEvent(...))` to communicate with the session side panel. In the target component, listen via `window.addEventListener` in `onMount`.

## How to Add a Side Panel Tab (Step-by-Step)

```tsx
// 1. Create the panel component (e.g., memory-panel.tsx)
export function MemoryPanel() { ... }

// 2. In session-side-panel.tsx:
//    a. Import the component
//    b. Add the state (sync with tabs system, filter from openedTabs)
//    c. Add the tab trigger in Tabs.List (before context trigger)
//    d. Add the content panel in the right section (between empty and context content)
//    e. Override activeTab memo to handle the new tab

// State pattern:
const memoryOpen = createMemo(() => 
  tabs().active() === "memory" || tabs().all().includes("memory")
)
const openedTabs = createMemo(() => 
  tabState.openedTabs().filter((t) => t !== "memory") // filter out from file tabs
)

// Active tab override:
const activeTab = createMemo(() => {
  const active = tabs().active()
  if (active === "context" || active === "review" || (active && active !== "memory")) return active
  if (memoryOpen()) return "memory"
  return activeTabInternal()
})
```

## Known Bugs & Fixes

### 1. Phantom close button on custom tabs
**Symptom:** An "x" appears on hover with "close tab" tooltip on custom tab triggers.
**Cause:** Kobalte Tabs renders close button; `hideCloseButton` sets `data-hidden="true"` but no CSS hides it.
**Fix:** Added to `packages/app/src/index.css`:
```css
[data-slot="tabs-trigger-close-button"][data-hidden="true"] { display: none !important }
```

### 2. Custom tab not rendering content
**Symptom:** Tab appears but content panel stays hidden.
**Cause:** `activeTab` memo didn't include the new tab name. Kobalte tabs uses `value={activeTab()}`.
**Fix:** Override `activeTab` in the side panel to return the new tab name when open.

### 3. Custom tab blocking other tabs
**Symptom:** Can't click context/file tabs while custom tab is open.
**Cause:** Overriding activeTab unconditionally (always returns custom tab name).
**Fix:** Check `tabs().active()` first — if user explicitly clicked another tab, respect it.

### 4. Comment replacing import line
**Symptom:** `ReferenceError: Schema is not defined` (or Context, path, etc.)
**Cause:** Adding a file header comment with the edit tool, where `oldString` matched the first line (the import). The `newString` replaced it with just the comment.
**Fix:** Always put `newString = "import {...} from '...'\n// comment comment"` — keep the import AND add the comment.

### 5. Effect.tryPromise with object form
**Symptom:** `error=[]` defect during config loading.
**Cause:** `Effect.tryPromise({ try: async () => {...}, catch: () => [] })` — Effect v4 requires catch in the options object.
**Fix:** Use `Effect.sync(() => { try {...} catch {...} })` instead for synchronous I/O.

### 6. IconButton vs Button+Icon
**Symptom:** Icon not rendering.
**Cause:** `IconButton` uses the AppIcon sprite sheet (editor icons only: vscode, cursor, terminal, etc.). Regular `Icons` like "archive", "settings", "help" come from a different SVG set.
**Fix:** Use `<Button variant="ghost" class="titlebar-icon ..."><Icon size="small" name="archive" ... /></Button>` pattern.

### 7. Multiple Electron/bun/node processes
**Symptom:** Changes not showing, port conflicts, stale UI.
**Cause:** Previous `bun dev:desktop` instances left running.
**Fix:** Always run `Get-Process -Name "electron","node","bun" | Stop-Process -Force` before restarting.

## Effect Layer System

- Every service is `Context.Service` + `Layer.effect`
- `AppLayer` (app-runtime.ts) provides ALL services
- `InstanceState` (ScopedCache keyed by directory) for per-project state
- `InstanceRef` fallback needed at server startup; middleware overrides per-request
- `Effect.fn` for traced, `Effect.fnUntraced` for internal
- `Effect.orDie` converts errors to defects (unrecoverable)

## Debugging

| Method | How |
|--------|-----|
| Sidecar log level | `$env:AGENCE_LOG_LEVEL="DEBUG"; bun dev:desktop` |
| Desktop DevTools | `Ctrl+Shift+I` in Electron window |
| Health check | `GET /global/health` |
| Monitor state | `GET /monitor/state` (JSON) |
| Server log | `~/.local/share/agence/log/dev.log` |
| Kill all processes | `Get-Process "electron","node","bun" \| Stop-Process -Force` |

## OpenCode → Agence Rename (Patterns That Caused Bugs)

- `opencode/` in user-agent/db filenames — regex protected `/` and `-`
- `~opencode/InstanceRef` — protected by `~` prefix
- `Effect.tryPromise({try, catch})` — Effect v4 object form needs catch in options
- `export { workspaceID }` — accidentally removed during edit revert
- Comment replacing import — NEVER replace line 1 of a file
