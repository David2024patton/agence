# Getting started with Agence

Agence is a **project-first** AI coding agent. You open a folder as a project, connect a model provider, then chat with tools scoped to that workspace.

## Day-one checklist

1. **Launch** — Desktop app (`bun dev:desktop` from repo root) or packaged installer.
2. **Open a project** — Home → add folder (any repo or empty directory).
3. **Connect a provider** — Settings → Providers (e.g. OpenCode Zen, API key, local Ollama).
4. **Pick a model** — Settings → Models, then select model + agent in the composer.
5. **Start a session** — Home → New session, or sidebar → project → chat.
6. **Optional** — Project Hub (gear icon): persona, skills, MCPs, bundles, goal.

## What works without a project

| Surface | Purpose |
| --- | --- |
| **Home** (`/`) | Add/open projects, recent sessions (dev UI) |
| **Settings → General / Shortcuts / Providers / Models** | Desktop and server configuration |
| **Monitor** (`/monitor`) | Sidecar health, sessions, events |

Agent chat, personas, skills, MCPs, memory ingest, and hub APIs **require an open project**.

## What happens when you open a folder

First access auto-scaffolds the project bundle:

| Path | Purpose |
| --- | --- |
| `.agence/project.json` | Manifest: persona, goal, enabled resource groups |
| `.agence/registry.json` | Installed personas/skills/MCPs |
| `.agence/knowledge/wiki/` | Seeded product docs (this guide, memory, heartbeat, …) |
| Default persona | **`build`** |
| Default bundle | **`default`** |

No manual `agence init` required.

## Chat inside a project

Route: `/{project}/session` or `/{project}/session/{id}`.

### Chat modes (composer)

| Mode | Use |
| --- | --- |
| **Build** | Full agent: files, terminal, patches, tools |
| **Plan** | Read/analyze; edit plan markdown only |
| **Research** | Search/read; must write report under `.agence/knowledge/wiki/research/` or `.agence/knowledge/reports/` |

Modes are **not** separate agents — they restrict tools on the same session.

### Built-in personas

- **`build`** — default full-access agent
- **`plan`** — planning agent (permission profile)

Subagents (e.g. explore) are for task/manual invocation, not default chat.

### Session features

- File tabs, diffs, integrated terminal
- Memory panel (conversations + learnings)
- Attachments (images, files; plain paste → `.txt` attachment)
- Permission prompts (optional auto-accept per directory)
- **`/goal`** — project-wide goal (shared across sessions); also set in Project Hub → Goal

## Project Hub

Open from the **project gear** in the sidebar (or `/hub?directory=...`).

| Section | What you can do |
| --- | --- |
| **Persona** | Switch or create custom personas (`.agence/agents/*.md`) |
| **Skills** | View/toggle skills for this project |
| **MCPs** | View MCP connection status from `opencode.jsonc` |
| **Bundles** | Enable resource groups |
| **Goal** | Set the project completion contract |

Install extras via **GitHub link** or **upload** in Hub sections.

## Learning (Settings → Learning)

All learning features are **per project** (active worktree in Settings).

| Tab | Purpose |
| --- | --- |
| **Memory** | Auto-capture, maintenance, recent learnings |
| **Documents** | Upload PDF/Word/md/txt for memory ingest |
| **Knowledge** | Wiki stats; open `/library` browser |
| **Skills** | Skill-related memory view |
| **Heartbeat** | Edit `HEARTBEAT.md` scheduled tasks |

**Knowledge browser:** sidebar archive icon → `/library?directory=...`

## MCP server (optional)

```bash
# List all known projects (Cursor discovery)
agence mcp serve --global

# Full hub + memory + proxied MCP tools for one project
agence mcp serve -d C:\path\to\project
```

See [project-hub.md](project-hub.md) for Cursor `mcp.json` examples.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| “Open a project first” | Add/open a folder from Home before chat or Learning settings |
| Composer won’t send | Connect provider + select model and agent |
| Knowledge/Heartbeat 500 or HTML | Restart desktop: `bun dev:desktop` (rebuilds sidecar) |
| Stale UI after backend pull | Hard refresh or relaunch Electron |

## Next reads

- [Project Hub](project-hub.md) — bundles, goals, MCP modes
- [Learning overview](learning/README.md) — memory, wiki, heartbeat
- [Agence vs OpenCode](agence-vs-opencode.md) — fork differences
- [PROJECT-MAP.md](../PROJECT-MAP.md) — contributor architecture map
