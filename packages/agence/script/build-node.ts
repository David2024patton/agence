#!/usr/bin/env bun

import { Script } from "@agence-ai/script"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")

process.chdir(dir)

const generated = await import("./generate.ts")

// Load migrations from migration directories
const migrationDirs = (
  await fs.promises.readdir(path.join(dir, "migration"), {
    withFileTypes: true,
  })
)
  .filter((entry) => entry.isDirectory() && /^\d{4}\d{2}\d{2}\d{2}\d{2}\d{2}/.test(entry.name))
  .map((entry) => entry.name)
  .sort()

const migrations = await Promise.all(
  migrationDirs.map(async (name) => {
    const file = path.join(dir, "migration", name, "migration.sql")
    const sql = await Bun.file(file).text()
    const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(name)
    const timestamp = match
      ? Date.UTC(
          Number(match[1]),
          Number(match[2]) - 1,
          Number(match[3]),
          Number(match[4]),
          Number(match[5]),
          Number(match[6]),
        )
      : 0
    return { sql, timestamp, name }
  }),
)
console.log(`Loaded ${migrations.length} migrations`)

await Bun.build({
  target: "node",
  entrypoints: ["./src/node.ts"],
  outdir: "./dist/node",
  format: "esm",
  sourcemap: "linked",
  external: ["jsonc-parser", "@lydell/node-pty"],
  define: {
    AGENCE_MIGRATIONS: JSON.stringify(migrations),
    AGENCE_MODELS_DEV: generated.modelsData,
    AGENCE_CHANNEL: `'${Script.channel}'`,
  },
  files: {
    "opencode-web-ui.gen.ts": "",
  },
})

console.log("Build complete")

const wikiSeedSrc = path.join(dir, "src", "learning", "wiki-seed")
const wikiSeedDest = path.join(dir, "dist", "node", "wiki-seed")
if (fs.existsSync(wikiSeedSrc)) {
  fs.cpSync(wikiSeedSrc, wikiSeedDest, { recursive: true })
  console.log("Copied wiki-seed assets")
}

// Ensure ESM module type so Vite doesn't try to CJS-wrap the file
fs.writeFileSync(path.join(dir, "dist", "node", "package.json"), '{"type":"module"}\n')

// Workaround: esbuild's SSR bundler on Windows chokes on "undefined" string
// literals in large bundled files. Replace with a safe alias at the byte level.
const nodeFile = path.join(dir, "dist", "node", "node.js")
if (fs.existsSync(nodeFile)) {
  let content = fs.readFileSync(nodeFile, "utf8")
  const before = content.length
  // Only replace "undefined" when used as a string comparison value, not as a return value
  content = content.replace(/=== "undefined"/g, '=== ("undef"+"ined")')
  content = content.replace(/!== "undefined"/g, '!== ("undef"+"ined")')
  content = content.replace(/typeof .+ === "undefined"/g, (m) => m.replace('"undefined"', '("undef"+"ined")'))
  content = content.replace(/typeof .+ !== "undefined"/g, (m) => m.replace('"undefined"', '("undef"+"ined")'))
  content = content.replace(/\.includes\("undefined"\)/g, '.includes("undef"+"ined")')
  content = content.replace(/=== 'undefined'/g, "=== ('undef'+'ined')")
  content = content.replace(/!== 'undefined'/g, "!== ('undef'+'ined')")
  if (content.length !== before) {
    fs.writeFileSync(nodeFile, content, "utf8")
    console.log(`Patched "undefined" string literals in node.js (${before - content.length} bytes changed)`)
  }
}
