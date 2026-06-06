<p align="center">
  <a href="https://github.com/David2024patton/agence">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Agence logo">
    </picture>
  </a>
</p>
<p align="center">Otwartoźródłowy agent kodujący AI.</p>
<p align="center">
  <a href="https://github.com/David2024patton/agence/discord"><img alt="Discord" src="https://img.shields.io/discord/1391832426048651334?style=flat-square&label=discord" /></a>
  <a href="https://www.npmjs.com/package/agence-ai"><img alt="npm" src="https://img.shields.io/npm/v/agence-ai?style=flat-square" /></a>
  <a href="https://github.com/David2024patton/agence/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/anomalyco/opencode/publish.yml?style=flat-square&branch=dev" /></a>
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

### Instalacja

```bash
# YOLO
curl -fsSL https://github.com/David2024patton/agence/install | bash

# Menedżery pakietów
npm i -g agence-ai@latest        # albo bun/pnpm/yarn
scoop install agence             # Windows
choco install agence             # Windows
brew install David2024patton/tap/agence # macOS i Linux (polecane, zawsze aktualne)
brew install agence              # macOS i Linux (oficjalna formuła brew, rzadziej aktualizowana)
sudo pacman -S agence            # Arch Linux (Stable)
paru -S agence-bin               # Arch Linux (Latest from AUR)
mise use -g agence               # dowolny system
nix run nixpkgs#agence           # lub github:anomalyco/agence dla najnowszej gałęzi dev
```

> [!TIP]
> Przed instalacją usuń wersje starsze niż 0.1.x.

### Aplikacja desktopowa (BETA)

Agence jest także dostępny jako aplikacja desktopowa. Pobierz ją bezpośrednio ze strony [releases](https://github.com/David2024patton/agence/releases) lub z [agence.ai/download](https://github.com/David2024patton/agence/download).

| Platforma             | Pobieranie                         |
| --------------------- | ---------------------------------- |
| macOS (Apple Silicon) | `agence-desktop-mac-arm64.dmg`   |
| macOS (Intel)         | `agence-desktop-mac-x64.dmg`     |
| Windows               | `agence-desktop-windows-x64.exe` |
| Linux                 | `.deb`, `.rpm` lub AppImage        |

```bash
# macOS (Homebrew)
brew install --cask agence-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/agence-desktop
```

#### Katalog instalacji

Skrypt instalacyjny stosuje następujący priorytet wyboru ścieżki instalacji:

1. `$AGENCE_INSTALL_DIR` - Własny katalog instalacji
2. `$XDG_BIN_DIR` - Ścieżka zgodna ze specyfikacją XDG Base Directory
3. `$HOME/bin` - Standardowy katalog binarny użytkownika (jeśli istnieje lub można go utworzyć)
4. `$HOME/.agence/bin` - Domyślny fallback

```bash
# Przykłady
AGENCE_INSTALL_DIR=/usr/local/bin curl -fsSL https://github.com/David2024patton/agence/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://github.com/David2024patton/agence/install | bash
```

### Agents

Agence zawiera dwóch wbudowanych agentów, między którymi możesz przełączać się klawiszem `Tab`.

- **build** - Domyślny agent z pełnym dostępem do pracy developerskiej
- **plan** - Agent tylko do odczytu do analizy i eksploracji kodu
  - Domyślnie odmawia edycji plików
  - Pyta o zgodę przed uruchomieniem komend bash
  - Idealny do poznawania nieznanych baz kodu lub planowania zmian

Dodatkowo jest subagent **general** do złożonych wyszukiwań i wieloetapowych zadań.
Jest używany wewnętrznie i można go wywołać w wiadomościach przez `@general`.

Dowiedz się więcej o [agents](https://github.com/David2024patton/agence/docs/agents).

### Dokumentacja

Więcej informacji o konfiguracji Agence znajdziesz w [**dokumentacji**](https://github.com/David2024patton/agence/docs).

### Współtworzenie

Jeśli chcesz współtworzyć Agence, przeczytaj [contributing docs](./CONTRIBUTING.md) przed wysłaniem pull requesta.

### Budowanie na Agence

Jeśli pracujesz nad projektem związanym z Agence i używasz "agence" jako części nazwy (na przykład "agence-dashboard" lub "agence-mobile"), dodaj proszę notatkę do swojego README, aby wyjaśnić, że projekt nie jest tworzony przez zespół Agence i nie jest z nami w żaden sposób powiązany.

---

**Dołącz do naszej społeczności** [Discord](https://discord.gg/agence) | [X.com](https://x.com/agence)
