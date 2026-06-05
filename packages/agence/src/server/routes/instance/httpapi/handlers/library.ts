import path from "path"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { AppFileSystem } from "@agence-ai/core/filesystem"
import {
  defaultHeartbeatTemplate,
  loadHeartbeatRuns,
  parseHeartbeatTasks,
  serializeHeartbeatContent,
} from "@/background/heartbeat"
import { ensureProjectWiki } from "@/learning/wiki-seed"
import { listWikiArticlesForProject } from "@/learning/wiki"
import { InstanceHttpApi } from "../api"
import { withProjectDirectory } from "./instance-scope"

function heartbeatPath(directory: string) {
  return path.join(directory, "HEARTBEAT.md")
}

function enrichTasks(
  tasks: ReturnType<typeof parseHeartbeatTasks>,
  runs: Record<string, number>,
  now = Date.now(),
) {
  return tasks.map((task) => {
    const lastRun = runs[task.taskName]
    const nextRunInMs = lastRun === undefined ? 0 : Math.max(0, task.intervalMs - (now - lastRun))
    return {
      enabled: task.enabled,
      interval: task.interval,
      taskName: task.taskName,
      prompt: task.prompt,
      intervalMs: task.intervalMs,
      lastRun,
      nextRunInMs,
    }
  })
}

function readHeartbeatState(directory: string) {
  return Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    const file = heartbeatPath(directory)
    const exists = yield* fs.existsSafe(file)
    const content = exists
      ? yield* fs.readFileString(file).pipe(Effect.catch(() => Effect.succeed("")))
      : ""
    const runs = yield* loadHeartbeatRuns(directory)
    const tasks = enrichTasks(parseHeartbeatTasks(content), runs)
    return { path: "HEARTBEAT.md", exists, content, tasks }
  })
}

function listWiki(directory: string) {
  return ensureProjectWiki(directory).pipe(
    Effect.catch(() => Effect.void),
    Effect.flatMap(() => listWikiArticlesForProject(directory)),
    Effect.map((listed) => ({ path: listed.path, files: listed.files })),
  )
}

import { InvalidRequestError } from "../errors"

export const libraryHandlers = HttpApiBuilder.group(InstanceHttpApi, "library", (handlers) =>
  Effect.gen(function* () {
    const list = Effect.fn("LibraryHttpApi.list")(function* () {
      return yield* withProjectDirectory((directory) => listWiki(directory)).pipe(
        Effect.catch((error) =>
          Effect.fail(
            new InvalidRequestError({
              message: String(error),
              kind: "Query",
              field: "directory",
            }),
          ),
        ),
      )
    })

    const heartbeatState = Effect.fn("LibraryHttpApi.heartbeatState")(function* () {
      return yield* withProjectDirectory((directory) => readHeartbeatState(directory)).pipe(
        Effect.catch((error) =>
          Effect.fail(
            new InvalidRequestError({
              message: String(error),
              kind: "Query",
              field: "directory",
            }),
          ),
        ),
      )
    })

    const heartbeatSave = Effect.fn("LibraryHttpApi.heartbeatSave")(function* (ctx: {
      payload: {
        tasks: readonly { enabled: boolean; interval: string; taskName: string; prompt: string }[]
        preamble?: string
      }
    }) {
      return yield* withProjectDirectory((directory) =>
        Effect.gen(function* () {
          const fs = yield* AppFileSystem.Service
          const file = heartbeatPath(directory)
          const existing = (yield* fs.existsSafe(file))
            ? yield* fs.readFileString(file).pipe(Effect.catch(() => Effect.succeed("")))
            : (ctx.payload.preamble ?? defaultHeartbeatTemplate)
          const content = serializeHeartbeatContent(ctx.payload.tasks, ctx.payload.preamble ?? existing)
          yield* fs.writeWithDirs(file, content)
          return yield* readHeartbeatState(directory)
        }),
      ).pipe(
        Effect.catch((error) =>
          Effect.fail(
            new InvalidRequestError({
              message: String(error),
              kind: "Query",
              field: "directory",
            }),
          ),
        ),
      )
    })

    const heartbeatInit = Effect.fn("LibraryHttpApi.heartbeatInit")(function* () {
      return yield* withProjectDirectory((directory) =>
        Effect.gen(function* () {
          const fs = yield* AppFileSystem.Service
          const file = heartbeatPath(directory)
          if (yield* fs.existsSafe(file)) return yield* readHeartbeatState(directory)
          yield* fs.writeWithDirs(file, defaultHeartbeatTemplate)
          return yield* readHeartbeatState(directory)
        }),
      ).pipe(
        Effect.catch((error) =>
          Effect.fail(
            new InvalidRequestError({
              message: String(error),
              kind: "Query",
              field: "directory",
            }),
          ),
        ),
      )
    })

    return handlers
      .handle("list", list)
      .handle("heartbeatState", heartbeatState)
      .handle("heartbeatSave", heartbeatSave)
      .handle("heartbeatInit", heartbeatInit)
  }),
)
