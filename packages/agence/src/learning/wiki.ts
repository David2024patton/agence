import path from "path"
import fs, { stat } from "node:fs/promises"
import { Effect } from "effect"
import { projectKnowledgePaths } from "./knowledge-paths"

function extractWikiLinks(content: string) {
  const links: string[] = []
  const pattern = /\[\[([^\]]+)\]\]/g
  let match = pattern.exec(content)
  while (match) {
    const slug = match[1].trim().toLowerCase().replace(/\s+/g, "-")
    if (!links.includes(slug)) links.push(slug)
    match = pattern.exec(content)
  }
  return links
}

type WikiFile = { name: string; content: string; links: string[]; backlinks: string[] }

function isDirectory(pathname: string) {
  return Effect.tryPromise(async () => {
    const info = await stat(pathname)
    return info.isDirectory()
  }).pipe(Effect.catch(() => Effect.succeed(false)))
}

function scanMarkdownDir(dir: string) {
  return Effect.gen(function* () {
    if (!(yield* isDirectory(dir))) return [] as { name: string; content: string; links: string[] }[]

    const names = yield* Effect.tryPromise(async () => {
      const files = await fs.readdir(dir)
      return files.filter((f) => f.endsWith(".md"))
    }).pipe(Effect.catch(() => Effect.succeed([] as string[])))

    return yield* Effect.forEach(
      names,
      (name) =>
        Effect.gen(function* () {
          const filePath = path.join(dir, name)
          const content = yield* Effect.tryPromise(() => fs.readFile(filePath, "utf8")).pipe(
            Effect.catch(() => Effect.succeed("")),
          )
          return { name, content, links: extractWikiLinks(content) }
        }),
      { concurrency: "unbounded", discard: false },
    )
  })
}

function withBacklinks(files: { name: string; content: string; links: string[] }[]): WikiFile[] {
  const backlinks = new Map<string, string[]>()
  for (const file of files) {
    const source = file.name.replace(/\.md$/, "")
    for (const link of file.links) {
      const list = backlinks.get(link) ?? []
      if (!list.includes(source)) list.push(source)
      backlinks.set(link, list)
    }
  }

  return files.map((file) => ({
    name: file.name,
    content: file.content,
    links: file.links,
    backlinks: backlinks.get(file.name.replace(/\.md$/, "")) ?? [],
  }))
}

export function listWikiArticlesForProject(projectDirectory: string) {
  const paths = projectKnowledgePaths(projectDirectory)
  return listWikiArticles(paths.wiki, paths.root, paths.wikiRel)
}

export function listWikiArticles(wikiDir: string, legacyRoot?: string, displayPath = wikiDir) {
  return Effect.gen(function* () {
    const wikiFiles = yield* scanMarkdownDir(wikiDir)
    const legacyFiles =
      legacyRoot && path.resolve(legacyRoot) !== path.resolve(wikiDir) ? yield* scanMarkdownDir(legacyRoot) : []

    const seen = new Set(wikiFiles.map((file) => file.name))
    const merged = [
      ...wikiFiles,
      ...legacyFiles.filter((file) => !seen.has(file.name) && file.name !== "memory.md" && file.name !== "index.md"),
    ]

    return {
      path: displayPath,
      pathAbsolute: wikiDir,
      files: withBacklinks(merged),
    }
  })
}
