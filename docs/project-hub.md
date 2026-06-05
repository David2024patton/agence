# Project Hub

Each Agence project is a **directory** with a hub bundle under `.agence/`.

> First time? Read [getting-started.md](getting-started.md) for the day-one flow.

## Project-only enforcement

Agence treats the **project directory** as the unit of work. Without an explicit project path, the agent and hub features are unavailable.

| Surface | Requirement |
| --- | --- |
| **Chat / sessions** | URL `/:dir/session/...` or SDK header `x-opencode-directory` |
| **Persona, skills, MCPs** | Loaded only after `InstanceContextMiddleware` validates the project |
| **Hub / memory / library** | `?directory=` query or directory header; returns **400** if missing |
| **Home / monitor** | No project required (landing and ops dashboard) |
| **MCP `serve --global`** | Lists projects only; use `serve -d <dir>` for tools |

Backend: **`assertProjectDirectory`** in `packages/agence/src/project/require-project.ts` — verifies the path exists, scaffolds `.agence/` via **`ensureHubBundle`** on first open. Workspace routing no longer falls back to `process.cwd()`.

Desktop: composer submit and Knowledge/Hub pages show “open a project first” when no worktree is selected.

## Auto-setup (new projects)

When a project is first opened (instance bootstrap) or hub state is loaded:

- `.agence/project.json` — manifest (`persona_id`, `goal`, `enabled_groups`, …)
- `.agence/registry.json` — custom installs and groups
- `.agence/knowledge/wiki/` — seeded self-docs
- Default persona **`build`** and bundle **`default`** if unset
- Entry in **`~/.local/share/agence/projects-index.json`** (and merged from desktop `agence.global.dat` when present)

## Desktop UI

Project Hub dialog / `/hub?directory=...` — persona, skills, MCPs, bundles, custom personas (`.agence/agents/*.md`).

## MCP server modes

### Global — all projects

```bash
agence mcp serve --global
```

From a directory **without** `.agence/`, this is the default.

- Resource: `agence://projects/list`
- Tool: `agence_list_projects`

Use this in Cursor as a root “Agence” MCP to discover worktrees, then point a second MCP at a project directory.

### Per-project — full hub

```bash
agence mcp serve --directory C:\path\to\project
```

Runs instance bootstrap (config, MCP clients, skills, memory DB).

**Resources**

- `agence://project/manifest`
- `agence://project/hub`
- `agence://project/persona`
- `agence://project/directory`

**Hub tools**

| Tool | Purpose |
| --- | --- |
| `agence_hub_state` | Full hub JSON (refresh) |
| `agence_set_persona` | Set active persona id |
| `agence_save_persona` | Create/update `.agence/agents/*.md` |
| `agence_set_goal` | Update project goal |
| `agence_memory_recall` | Search SQLite learnings (+ global) |
| `agence_memory_add` | Write a learning row |

**Proxied MCP tools**

Connected MCP servers from `opencode.jsonc` are exposed as `mcp__<server>__<tool>` and executed through Agence’s MCP clients.

## Project Goal (GUI + chat)

Each project has **one Goal**, stored in `.agence/project.json` and mirrored to `.agence/goal.json` (status, budget, auto-continue).

| Where | What happens |
| --- | --- |
| **Project Hub → Goal** | Saves manifest + activates Goal for **all sessions** in this project |
| **Chat `/goal …`** | Same store — updates manifest and goal state |
| `/goal pause` · `resume` · `clear` | Lifecycle for the **project** Goal |

When a Goal is **active**, every session in that project gets reminders, auto-continue (budget 20), and the `goal_complete` tool.

```text
/goal Reduce p95 below 120ms, verified by checkout benchmark, while keeping tests green
/goal          View status
/goal pause    Pause auto-continue
/goal resume   Resume working
/goal clear    Clear project Goal
```


## Cursor example

```json
{
  "mcpServers": {
    "agence-projects": {
      "command": "agence",
      "args": ["mcp", "serve", "--global"]
    },
    "agence-this-repo": {
      "command": "agence",
      "args": ["mcp", "serve", "--directory", "C:\\Users\\David\\AI\\agence"]
    }
  }
}
```

Restart desktop (`bun dev:desktop`) after pulling so the sidecar includes new hub/MCP code.
