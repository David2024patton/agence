import path from "path"
import { fileURLToPath } from "url"
import fs from "node:fs/promises"
import { Effect } from "effect"
import { projectKnowledgePaths } from "./knowledge-paths"

/** Bundled skill articles (web, SEO, marketing) — always seeded if missing. */
const SKILL_WIKI = new Set([
  "web-design-fundamentals.md",
  "seo-basics.md",
  "web-accessibility.md",
  "web-performance.md",
  "content-marketing-basics.md",
])

const PROJECT_DOC_MAP: readonly { rel: string; dest: string }[] = [
  { rel: "docs/getting-started.md", dest: "getting-started.md" },
  { rel: "docs/learning/README.md", dest: "learning-subsystem.md" },
  { rel: "docs/learning/memory.md", dest: "memory-sqlite.md" },
  { rel: "docs/learning/knowledge-and-library.md", dest: "knowledge-and-library.md" },
  { rel: "docs/learning/heartbeat.md", dest: "heartbeat.md" },
  { rel: "docs/learning/desktop-settings.md", dest: "desktop-settings.md" },
  { rel: "docs/agence-vs-opencode.md", dest: "agence-vs-opencode.md" },
  { rel: "docs/README.md", dest: "docs-readme.md" },
  { rel: "AGENCE.md", dest: "agence-knowledge-base.md" },
  { rel: "PROJECT-MAP.md", dest: "project-map.md" },
]

function bundledWikiDirCandidates() {
  const candidates: string[] = []
  const meta = import.meta as ImportMeta & { dirname?: string; dir?: string }
  const base = meta.dirname ?? meta.dir
  if (typeof base === "string" && base.length > 0) candidates.push(path.join(base, "wiki-seed"))
  if (typeof import.meta.url === "string" && import.meta.url.length > 0) {
    const dir = path.dirname(fileURLToPath(import.meta.url))
    candidates.push(path.join(dir, "wiki-seed"))
    candidates.push(path.join(dir, "learning", "wiki-seed"))
  }
  candidates.push(path.join(process.cwd(), "packages", "agence", "dist", "node", "wiki-seed"))
  candidates.push(path.join(process.cwd(), "packages", "agence", "src", "learning", "wiki-seed"))
  return [...new Set(candidates)]
}

async function bundledWikiDir() {
  for (const candidate of bundledWikiDirCandidates()) {
    if (await pathExists(candidate)) return candidate
  }
  return undefined
}

async function pathExists(pathname: string) {
  return fs.stat(pathname).then(() => true).catch(() => false)
}

async function readText(pathname: string) {
  return fs.readFile(pathname, "utf8")
}

async function listBundledMarkdown() {
  const root = await bundledWikiDir()
  if (!root) return [] as string[]

  try {
    const files = await fs.readdir(root)
    return files.filter((f) => f.endsWith(".md")).sort()
  } catch {
    return [] as string[]
  }
}

function titleFromFilename(name: string) {
  return name
    .replace(/\.md$/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function buildIndex(articleNames: string[]) {
  const articles = articleNames.filter((name) => name !== "index.md")
  const skills = articles.filter((name) => SKILL_WIKI.has(name)).sort((a, b) => a.localeCompare(b))
  const product = articles.filter((name) => !SKILL_WIKI.has(name)).sort((a, b) => a.localeCompare(b))
  const skillLines = skills.map((name) => `- [[${titleFromFilename(name)}]]`)
  const productLines = product.map((name) => `- [[${titleFromFilename(name)}]]`)
  return [
    "# Knowledge Base Index",
    "",
    "Seeded reference articles for this project. Edit freely; new bundled articles appear after reload when missing.",
    "",
    "## Web, SEO & marketing",
    "",
    ...(skillLines.length > 0 ? skillLines : ["- _(none yet)_"]),
    "",
    "## Agence & product",
    "",
    ...(productLines.length > 0 ? productLines : ["- _(none yet)_"]),
    "",
    "## See also",
    "",
    "- Repo docs: `docs/learning/`",
    "- Architecture map: `PROJECT-MAP.md`",
    "",
  ].join("\n")
}

const SEED_INDEX_MARKER = "Seeded reference articles for this project"

async function refreshWikiIndex(wikiDir: string) {
  const indexPath = path.join(wikiDir, "index.md")
  const articleNames: string[] = []
  try {
    const files = await fs.readdir(wikiDir)
    for (const rel of files.filter((f) => f.endsWith(".md"))) articleNames.push(rel)
  } catch {
    return
  }
  const next = buildIndex(articleNames)
  const existing = (await pathExists(indexPath)) ? await readText(indexPath).catch(() => "") : ""
  if (!existing || existing.includes(SEED_INDEX_MARKER) || existing.includes("Knowledge Base Index")) {
    await fs.writeFile(indexPath, next, "utf8")
  }
}

async function writeIfMissing(dest: string, content: string) {
  if (await pathExists(dest)) return false
  await fs.writeFile(dest, content, "utf8")
  return true
}

export async function ensureProjectWikiSync(projectDirectory: string) {
  const paths = projectKnowledgePaths(projectDirectory)
  const wikiDir = paths.wiki
  await fs.mkdir(wikiDir, { recursive: true })

  const written: string[] = []
  const bundledDir = await bundledWikiDir()

  for (const name of await listBundledMarkdown()) {
    if (name === "index.md" || !bundledDir) continue
    const src = path.join(bundledDir, name)
    if (!(await pathExists(src))) continue
    const dest = path.join(wikiDir, name)
    const content = await readText(src)
    if (await writeIfMissing(dest, content)) written.push(name)
  }

  for (const entry of PROJECT_DOC_MAP) {
    const src = path.join(projectDirectory, entry.rel)
    if (!(await pathExists(src))) continue
    const dest = path.join(wikiDir, entry.dest)
    const content = await readText(src)
    if (await writeIfMissing(dest, content)) written.push(entry.dest)
  }

  const learningDir = path.join(projectDirectory, "docs", "learning")
  if (await pathExists(learningDir)) {
    try {
      const files = await fs.readdir(learningDir)
      for (const rel of files.filter((f) => f.endsWith(".md"))) {
        const dest = path.join(wikiDir, rel)
        const content = await readText(path.join(learningDir, rel))
        if (await writeIfMissing(dest, content)) written.push(rel)
      }
    } catch (e) {
      // Ignore
    }
  }

  if (written.length > 0 || !(await pathExists(path.join(wikiDir, "index.md")))) {
    await refreshWikiIndex(wikiDir)
    if (!written.includes("index.md")) written.push("index.md")
  } else {
    await refreshWikiIndex(wikiDir)
  }

  const articleNames: string[] = []
  try {
    const files = await fs.readdir(wikiDir)
    for (const rel of files.filter((f) => f.endsWith(".md"))) articleNames.push(rel)
  } catch (e) {
    // Ignore
  }

  return { wikiDir, written, articleCount: articleNames.length }
}

export function ensureProjectWiki(projectDirectory: string) {
  return Effect.tryPromise(() => ensureProjectWikiSync(projectDirectory))
}
