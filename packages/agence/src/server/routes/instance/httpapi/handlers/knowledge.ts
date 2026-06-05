import { stat } from "node:fs/promises"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { projectKnowledgePaths } from "@/learning/knowledge-paths"
import { ensureProjectWiki } from "@/learning/wiki-seed"
import { listWikiArticlesForProject } from "@/learning/wiki"
import { InstanceHttpApi } from "../api"
import { withProjectDirectory } from "./instance-scope"

function dirExists(pathname: string) {
  return Effect.tryPromise(async () => {
    const info = await stat(pathname)
    return info.isDirectory()
  }).pipe(Effect.catch(() => Effect.succeed(false)))
}

function knowledgeState(directory: string) {
  return ensureProjectWiki(directory).pipe(
    Effect.catch(() => Effect.void),
    Effect.flatMap(() => listWikiArticlesForProject(directory)),
    Effect.flatMap((listed) =>
      Effect.gen(function* () {
        const paths = projectKnowledgePaths(directory)
        const wikiDirExists = yield* dirExists(paths.wiki)
        const rootDirExists = yield* dirExists(paths.root)
        const exists = listed.files.length > 0 || wikiDirExists || rootDirExists
        return {
          path: listed.path,
          exists,
          articleCount: listed.files.length,
          files: listed.files,
        }
      }),
    ),
  )
}

function listWiki(directory: string) {
  return ensureProjectWiki(directory).pipe(
    Effect.catch(() => Effect.void),
    Effect.flatMap(() => listWikiArticlesForProject(directory)),
    Effect.map((listed) => ({ path: listed.path, files: listed.files })),
  )
}

export const knowledgeHandlers = HttpApiBuilder.group(InstanceHttpApi, "knowledge", (handlers) =>
  Effect.gen(function* () {
    const state = Effect.fn("KnowledgeHttpApi.state")(function* () {
      return yield* withProjectDirectory((directory) => knowledgeState(directory))
    })

    const list = Effect.fn("KnowledgeHttpApi.list")(function* () {
      return yield* withProjectDirectory((directory) => listWiki(directory))
    })

    return handlers.handle("state", state).handle("list", list)
  }),
)
