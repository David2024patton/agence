import fs from "fs"
import path from "path"

const root = "C:\\Users\\David\\AI\\smart-hub\\opencode01"
const excludeDirs = new Set(["node_modules", "vendor", ".git", "dist", ".turbo", ".cache"])
const includeExtensions = new Set([
  ".ts", ".js", ".json", ".jsonc", ".md", ".yml", ".yaml", ".toml",
  ".html", ".css", ".sh", ".ps1", ".bat", ".mjs", ".cjs", ".tsx", ".jsx",
  ".svelte", ".vue", ".mdx", ".txt", ".nix", ".astro",
])

function getFiles(dir) {
  const files = []
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (excludeDirs.has(entry.name)) continue
      if (entry.name.includes("rename-agence") || entry.name.includes("rename-pass2")) continue
      if (entry.isDirectory()) {
        files.push(...getFiles(full))
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name)
        if (includeExtensions.has(ext) || (ext === "" && !entry.name.startsWith("."))) {
          files.push(full)
        }
      }
    }
  } catch {}
  return files
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const replacements = [
  // Longest patterns first
  { search: "@agence-ai", replace: "@agence-ai" },
  { search: "@agence/", replace: "@agence/" },
  { search: "https://github.com/David2024patton/agence", replace: "https://github.com/David2024patton/agence" },
  { search: "packages/agence/", replace: "packages/agence/" },
  { search: "packages\\agence\\", replace: "packages\\agence\\" },
  { search: "AGENCE_", replace: "AGENCE_" },
  { search: "agence-ai", replace: "agence-ai" },
  { search: "Agence", replace: "Agence" },
]

const files = getFiles(root)
console.log("Found " + files.length + " files")

let changed = 0
for (const file of files) {
  let content
  try { content = fs.readFileSync(file, "utf-8") } catch { continue }

  let modified = content
  let hasChange = false

  // Safe string replacements
  for (const { search, replace } of replacements) {
    const re = new RegExp(escapeRegex(search), "g")
    if (re.test(modified)) {
      modified = modified.replace(re, replace)
      hasChange = true
    }
  }

  // Word-boundary replacement: "agence" not preceded by @ or .
  // and not followed by .json, .jsonc, word char, /, -
  const wordRe = /(?<![@.])agence(?!\.(?:json|jsonc)|[\w\/-])/g
  if (wordRe.test(modified)) {
    modified = modified.replace(wordRe, "agence")
    hasChange = true
  }

  if (hasChange) {
    fs.writeFileSync(file, modified, "utf-8")
    changed++
    if (changed <= 20 || changed % 100 === 0) {
      console.log("  [" + changed + "] " + path.relative(root, file))
    }
  }
}

console.log("\nTotal files modified: " + changed)
