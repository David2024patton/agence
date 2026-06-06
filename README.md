<p align="center">
  <a href="https://github.com/David2024patton/agence">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Agence logo">
    </picture>
  </a>
</p>
<p align="center">The open source AI coding agent.</p>
<p align="center">
  <a href="https://github.com/David2024patton/agence/discord"><img alt="Discord" src="https://img.shields.io/discord/1391832426048651334?style=flat-square&label=discord" /></a>
  <a href="https://www.npmjs.com/package/agence-ai"><img alt="npm" src="https://img.shields.io/npm/v/agence-ai?style=flat-square" /></a>
  <a href="https://github.com/David2024patton/agence/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/David2024patton/agence/publish.yml?style=flat-square&branch=main" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.da.md">Dansk</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.pl.md">Polski</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.bs.md">Bosanski</a> |
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a> |
  <a href="README.bn.md">বাংলা</a> |
  <a href="README.gr.md">Ελληνικά</a> |
  <a href="README.vi.md">Tiếng Việt</a>
</p>

[![Agence Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://github.com/David2024patton/agence)

---

### Installation

```bash
# YOLO
curl -fsSL https://github.com/David2024patton/agence/install | bash

# Package managers
npm i -g agence-ai@latest        # or bun/pnpm/yarn
scoop install agence             # Windows
choco install agence             # Windows
brew install David2024patton/tap/agence # macOS and Linux (recommended, always up to date)
brew install agence              # macOS and Linux (official brew formula, updated less)
sudo pacman -S agence            # Arch Linux (Stable)
paru -S agence-bin               # Arch Linux (Latest from AUR)
mise use -g agence               # Any OS
nix run nixpkgs#agence           # or github:David2024patton/agence for latest dev branch
```

> [!TIP]
> Remove versions older than 0.1.x before installing.

### Desktop App (BETA)

Agence ships as an Electron desktop app. Check `packages/desktop/package.json` for the current version (e.g. **v1.16.5+**) on branch **`main`**.

<p align="left">
  <a href="https://github.com/David2024patton/agence/releases/latest">
    <img src="https://img.shields.io/badge/Download-Windows%20Installer-blue?style=for-the-badge&logo=windows" alt="Download Windows Installer" />
  </a>
</p>

> [!IMPORTANT]
> This repository is **private**. The [releases page](https://github.com/David2024patton/agence/releases/latest) and direct download URLs return **404** unless you are signed into GitHub with access to `David2024patton/agence`. That is expected for private repos, not a missing build.

#### Download (Windows, signed in to GitHub)

1. Open **[Releases](https://github.com/David2024patton/agence/releases/latest)** while logged in.
2. Download **`agence-desktop-win-x64.exe`** from the latest release (currently **v1.16.5**).

Or use the GitHub CLI (authenticated):

```powershell
gh auth login
gh release download v1.16.5 -R David2024patton/agence -p agence-desktop-win-x64.exe -D .
```

Direct asset URL (same login requirement):

`https://github.com/David2024patton/agence/releases/download/v1.16.5/agence-desktop-win-x64.exe`

#### Build the installer locally

From the repo root (after `bun install`):

```powershell
cd packages/desktop
$env:AGENCE_CHANNEL = "prod"
bun run prebuild
bun run build
# Packaging automatically generates a self-signed certificate, installs it to
# local Trusted Root Certification Authorities (so Windows trusts the app),
# and signs the executables.
bun run package:win
# Installer: packages/desktop/dist/agence-desktop-win-x64.exe

# To manually sign/re-sign built executables locally:
bun run sign:local
```

#### Dev (live reload)

```powershell
# Repo root — not packages/desktop
bun dev:desktop
```

Packaged installs check **GitHub Releases** on `David2024patton/agence` for updates (`electron-updater`).

| Platform              | Release asset (when published)   |
| --------------------- | -------------------------------- |
| Windows               | `agence-desktop-win-x64.exe`     |
| macOS / Linux         | Build locally (`package:mac` / `package:linux`) |

#### Installation Directory

The install script respects the following priority order for the installation path:

1. `$AGENCE_INSTALL_DIR` - Custom installation directory
2. `$XDG_BIN_DIR` - XDG Base Directory Specification compliant path
3. `$HOME/bin` - Standard user binary directory (if it exists or can be created)
4. `$HOME/.agence/bin` - Default fallback

```bash
# Examples
AGENCE_INSTALL_DIR=/usr/local/bin curl -fsSL https://github.com/David2024patton/agence/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://github.com/David2024patton/agence/install | bash
```

### Agents and chat modes

New users: see **[docs/getting-started.md](docs/getting-started.md)** for the full day-one flow (open project → connect provider → chat).

Agence includes built-in agents you can switch with the `Tab` key (desktop app).

- **build** — Default, full-access agent for development work
- **plan** — Read-only agent for analysis (denies edits; permission on bash)
- **research** — Read-focused mode with restricted write/shell/task tools (desktop)

Also included is a **general** subagent for complex searches (`@general` in messages).

Upstream-style agent docs may still live under `packages/web/src/content/docs/`.

### Learning (Agence-only)

| Feature | Where |
| --- | --- |
| **Memory** | SQLite learnings, auto-capture, Settings → Learning → Memory |
| **Knowledge wiki** | `.agence/knowledge/wiki/`, sidebar **Knowledge** → Library |
| **Heartbeat** | `HEARTBEAT.md` scheduled tasks, Settings → Learning → Heartbeat |

Docs: [**docs/README.md**](docs/README.md) · [**Agence vs OpenCode**](docs/agence-vs-opencode.md)

### Documentation

| Docs | Contents |
| --- | --- |
| [**docs/**](docs/README.md) | Agence fork: learning, desktop, vs OpenCode |
| [**PROJECT-MAP.md**](PROJECT-MAP.md) | Architecture and how to add APIs/tools |
| [**AGENCE.md**](AGENCE.md) | Tools list, paths, workflow |
| `packages/web/src/content/docs/` | Inherited OpenCode user guide (verify paths say **agence**) |

### Contributing

If you're interested in contributing to Agence, please read our [contributing docs](./CONTRIBUTING.md) before submitting a pull request.

### Building on Agence

If you are working on a project that's related to Agence and is using "agence" as part of its name, for example "agence-dashboard" or "agence-mobile", please add a note to your README to clarify that it is not built by the Agence team and is not affiliated with us in any way.

---

**Join our community** [Discord](https://discord.gg/agence) | [X.com](https://x.com/agence)
