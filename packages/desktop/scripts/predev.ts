import { $ } from "bun"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))

await $`bun ./scripts/copy-icons.ts ${process.env.AGENCE_CHANNEL ?? process.env.OPENCODE_CHANNEL ?? "dev"}`

// Clean caches to prevent stale chunk errors from esbuild
const desktopOut = path.join(scriptDir, "..", "out")
const nodeDist = path.join(scriptDir, "..", "..", "agence", "dist", "node")
if (fs.existsSync(desktopOut)) fs.rmSync(desktopOut, { recursive: true, force: true })
if (fs.existsSync(nodeDist)) fs.rmSync(nodeDist, { recursive: true, force: true })

await $`cd ../agence && bun script/build-node.ts`
