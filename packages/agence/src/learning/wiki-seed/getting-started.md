# Getting started with Agence

Agence is a **project-first** AI coding agent. Open a folder as a project, connect a model provider, then chat with tools scoped to that workspace.

## Day-one checklist

1. **Launch** — Desktop app or packaged installer.
2. **Open a project** — Home → add folder (any repo or empty directory).
3. **Connect a provider** — Settings → Providers (e.g. OpenCode Zen, API key, local Ollama).
4. **Pick a model** — Settings → Models, then select model + agent in the composer.
5. **Start a session** — Home → New session, or sidebar → project → chat.
6. **Optional** — Project Hub (gear icon): persona, skills, MCPs, bundles, goal.

## What works without a project

| Surface | Purpose |
| --- | --- |
| **Home** | Add/open projects, recent sessions |
| **Settings** (General, Shortcuts, Providers, Models) | Desktop and server configuration |
| **Monitor** | Sidecar health, sessions, events |

Agent chat, personas, skills, MCPs, memory ingest, and hub APIs **require an open project**.

## What happens when you open a folder

First access auto-scaffolds:

- `.agence/project.json` — manifest (persona, goal, bundles)
- `.agence/registry.json` — installed resources
- `.agence/knowledge/wiki/` — seeded docs (including this article)
- Default persona **`build`**, bundle **`default`**

## Chat modes

| Mode | Use |
| --- | --- |
| **Build** | Full agent: files, terminal, patches |
| **Plan** | Read/analyze; plan markdown only |
| **Research** | Search/read; report under `.agence/knowledge/wiki/research/` |

## Project Hub

Sidebar **gear** → persona, skills, MCPs, bundles, goal. Install resources via GitHub link or upload.

## Learning

Settings → Memory, Knowledge, Heartbeat (per open project). Sidebar **Knowledge** icon → wiki browser.

## See also

- [[Learning Subsystem]]
- [[Desktop Settings]]
- [[Knowledge And Library]]
