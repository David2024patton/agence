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
  <a href="https://github.com/anomalyco/opencode/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/anomalyco/opencode/publish.yml?style=flat-square&branch=dev" /></a>
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
brew install anomalyco/tap/agence # macOS and Linux (recommended, always up to date)
brew install agence              # macOS and Linux (official brew formula, updated less)
sudo pacman -S agence            # Arch Linux (Stable)
paru -S opencode-bin               # Arch Linux (Latest from AUR)
mise use -g agence               # Any OS
nix run nixpkgs#agence           # or github:anomalyco/agence for latest dev branch
```

> [!TIP]
> Remove versions older than 0.1.x before installing.

### Desktop App (BETA)

Agence ships as an Electron desktop app. **Latest stable:** `v1.16.1` on branch **`main`**.

> [!IMPORTANT]
> This repository is **private**. The [releases page](https://github.com/David2024patton/agence/releases/latest) and direct download URLs return **404** unless you are signed into GitHub with access to `David2024patton/agence`. That is expected for private repos, not a missing build.

#### Download (Windows, signed in to GitHub)

1. Open **[Releases](https://github.com/David2024patton/agence/releases/latest)** while logged in.
2. Download **`agence-desktop-win-x64.exe`** from the latest release (currently **v1.16.1**).

Or use the GitHub CLI (authenticated):

```powershell
gh auth login
gh release download v1.16.1 -R David2024patton/agence -p agence-desktop-win-x64.exe -D .
```

Direct asset URL (same login requirement):

`https://github.com/David2024patton/agence/releases/download/v1.16.1/agence-desktop-win-x64.exe`

#### Build the installer locally

From the repo root (after `bun install`):

```powershell
cd packages/desktop
$env:AGENCE_CHANNEL = "prod"
bun run prebuild
bun run build
bun run package:win
# Installer: packages/desktop/dist/agence-desktop-win-x64.exe
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
4. `$HOME/.opencode/bin` - Default fallback

```bash
# Examples
AGENCE_INSTALL_DIR=/usr/local/bin curl -fsSL https://github.com/David2024patton/agence/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://github.com/David2024patton/agence/install | bash
```

### Agents

Agence includes two built-in agents you can switch between with the `Tab` key.

- **build** - Default, full-access agent for development work
- **plan** - Read-only agent for analysis and code exploration
  - Denies file edits by default
  - Asks permission before running bash commands
  - Ideal for exploring unfamiliar codebases or planning changes

Also included is a **general** subagent for complex searches and multistep tasks.
This is used internally and can be invoked using `@general` in messages.

Learn more about [agents](https://github.com/David2024patton/agence/docs/agents).

### Documentation

For more info on how to configure Agence, [**head over to our docs**](https://github.com/David2024patton/agence/docs).

### Contributing

If you're interested in contributing to Agence, please read our [contributing docs](./CONTRIBUTING.md) before submitting a pull request.

### Building on Agence

If you are working on a project that's related to Agence and is using "agence" as part of its name, for example "opencode-dashboard" or "opencode-mobile", please add a note to your README to clarify that it is not built by the Agence team and is not affiliated with us in any way.

---

**Join our community** [Discord](https://discord.gg/agence) | [X.com](https://x.com/agence)
