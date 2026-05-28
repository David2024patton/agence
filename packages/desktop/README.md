# Agence Desktop

The Agence Desktop app, built with Electron.

## Development

From the **repo root** (rebuilds the agence sidecar via `predev`):

```bash
bun dev:desktop
```

## Releases

GitHub releases live on the private repo `David2024patton/agence`. Release pages 404 without repo access.

- Latest: [releases/latest](https://github.com/David2024patton/agence/releases/latest) (GitHub login required)
- Windows installer: `agence-desktop-win-x64.exe`

```bash
gh release download v1.16.1 -R David2024patton/agence -p agence-desktop-win-x64.exe
```

## Build

```bash
# packages/desktop
AGENCE_CHANNEL=prod bun run prebuild
bun run build
bun run package:win   # or package:mac / package:linux
```

Output: `dist/agence-desktop-win-x64.exe` (Windows).
