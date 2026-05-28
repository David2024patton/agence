import path from "path"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { InstanceState } from "@/effect/instance-state"
import { InstanceHttpApi } from "../api"

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

function listWikiFiles(wikiDir: string) {
  return Effect.gen(function* () {
    const dir = Bun.file(wikiDir)
    if (!(yield* Effect.tryPromise(() => dir.exists()))) return []

    const names: string[] = []
    const glob = new Bun.Glob("*.md")
    for (const rel of glob.scanSync({ cwd: wikiDir })) names.push(rel)

    const files = yield* Effect.forEach(names, (name) =>
      Effect.gen(function* () {
        const filePath = path.join(wikiDir, name)
        const content = yield* Effect.tryPromise(() => Bun.file(filePath).text())
        return { name, content, links: extractWikiLinks(content) }
      }),
    )

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
  })
}

export const libraryHandlers = HttpApiBuilder.group(InstanceHttpApi, "library", (handlers) =>
  Effect.gen(function* () {
    const list = Effect.fn("LibraryHttpApi.list")(function* () {
      const ctx = yield* InstanceState.context
      const wikiDir = path.join(ctx.directory, ".agence", "knowledge", "wiki")
      const files = yield* listWikiFiles(wikiDir)
      return { path: wikiDir, files }
    })

    return handlers.handle("list", list)
  }),
)
