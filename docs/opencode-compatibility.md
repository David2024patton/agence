# OpenCode compatibility

Agence intentionally keeps several **OpenCode names** in config, HTTP headers, and SDK symbols so existing workflows and docs mostly still work. Data directories and branding are **Agence**.

## Paths and branding

| Item | OpenCode (typical) | Agence |
| --- | --- | --- |
| Global config dir | `~/.config/opencode/` | `~/.config/agence/` |
| Data | `~/.local/share/opencode/` | `~/.local/share/agence/` |
| Cache | `~/.cache/opencode/` | `~/.cache/agence/` |
| Project config file | `opencode.json` / `opencode.jsonc` | `agence.json` / `agence.jsonc` |
| Skills directory | `.opencode/skills/` | `.agence/skills/` |
| Desktop app id | `ai.opencode.desktop` | `ai.agence.desktop` |
| Channel env | `OPENCODE_CHANNEL` | `AGENCE_CHANNEL` (also accepts legacy) |

Defined in `packages/core/src/global.ts`.

## HTTP API

- Workspace routing query: `directory`, `workspace`
- Header: **`x-opencode-directory`** (still used by the app)
- Client helper names may still say `createOpencodeClient` in SDK code

Instance routes are defined under `packages/agence/src/server/routes/instance/httpapi/`.

## Safe rename rules (from production bugs)

When merging upstream or doing bulk renames:

1. **Do not** blindly replace `opencode` inside `@opencode-ai/*` package names or `~opencode/InstanceRef` paths.
2. **Do not** rename `x-opencode-directory` without updating the desktop app and SDK together.
3. **Do** rename user-visible strings, log service names, and `ai.opencode.desktop` → `ai.agence.desktop`.
4. **Do** run `bun typecheck` in `packages/agence` and `packages/app` after upstream merges.

Details: [PROJECT-MAP.md](../PROJECT-MAP.md) section “OpenCode → Agence Rename”.

## Pulling upstream

```powershell
git remote add upstream https://github.com/anomalyco/opencode.git  # once
git fetch upstream
git merge upstream/dev   # or rebase per team policy
```

Resolve conflicts in `packages/agence`, `packages/app`, and branding files. Re-run desktop `prebuild` after server changes.

## Web docs (`packages/web`)

English MDX under `packages/web/src/content/docs/` is largely **upstream OpenCode** content. Paths may still say `opencode`. For Agence-only features use **`docs/`** in this repo (see [README.md](README.md)).
