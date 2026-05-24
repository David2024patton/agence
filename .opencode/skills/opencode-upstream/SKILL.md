---
name: opencode-upstream
description: Reference for the original opencode project that Agence was forked from. Use when comparing with upstream, merging changes, or understanding the original architecture.
---

# OpenCode Upstream Reference

Agence was forked from [anomalyco/opencode](https://github.com/anomalyco/opencode). The fork preserves
the original architecture while rebranding and adding features.

## Key Differences (Agence vs OpenCode)

| Aspect | OpenCode (Upstream) | Agence (Fork) |
|--------|-------------------|---------------|
| Repo | `anomalyco/opencode` | `David2024patton/agence` |
| NPM scope | `@opencode-ai/*` | `@agence-ai/*` (workspace), `@opencode-ai/*` (npm install) |
| Config dir | `~/.config/opencode/` | `~/.config/agence/` |
| Data dir | `~/.local/share/opencode/` | `~/.local/share/agence/` |
| Desktop ID | `ai.opencode.desktop.*` | `ai.agence.desktop.*` |
| CLI command | `opencode` | `agence` |
| Env vars | `OPENCODE_*` | `AGENCE_*` |
| Service scopes | `@opencode/` | `@agence/` |
| Project store | `.git/opencode` | `.git/agence` (falls back to `.git/opencode`) |
| Package dir | `packages/opencode/` | `packages/agence/` |

## Agence Additions (Not in Upstream)

| Feature | Files |
|---------|-------|
| Monitoring dashboard | `groups/monitor.ts`, `handlers/monitor.ts`, `pages/monitor.tsx` |
| Memory/conversation archive | `learning/archive.sql.ts`, `migration/...archive/` |
| MCP directory scanning | `config/config.ts` (loadInstanceState) |
| Self-contained dir config | `config/directories.ts` |
| Desktop Commander MCP | Configured in `~/.config/agence/opencode.jsonc` |
| Screenshot skill | `.opencode/skills/screenshots/SKILL.md` |
| Architecture skill | `.opencode/skills/agence-architecture/SKILL.md` |

## Pulling Upstream Changes

```bash
git fetch upstream
git merge upstream/main
# Fix conflicts — remembering the rename differences above
```

## Original Upstream Archive

The original opencode README, docs, and workflow files were preserved as-is
but with string replacements for the rename. Format conventions:
- Commits: `type(scope): summary` (feat, fix, docs, chore, refactor, test)
- Branch: `dev` (default), no `main` branch
- Tests: run from package dirs, NOT from root
