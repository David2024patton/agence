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



function readState(directory: string) {

  return Effect.gen(function* () {

    const fs = yield* AppFileSystem.Service

    const file = heartbeatPath(directory)

    const exists = yield* fs.existsSafe(file)

    const content = exists

      ? yield* fs.readFileString(file).pipe(Effect.catch(() => Effect.succeed("")))

      : ""

    const runs = yield* loadHeartbeatRuns(directory)

    const tasks = enrichTasks(parseHeartbeatTasks(content), runs)

    return { path: file, exists, content, tasks }

  })

}



export const heartbeatHandlers = HttpApiBuilder.group(InstanceHttpApi, "heartbeat", (handlers) =>

  Effect.gen(function* () {

    const state = Effect.fn("HeartbeatHttpApi.state")(function* () {

      return yield* withProjectDirectory((directory) => readState(directory))

    })



    const save = Effect.fn("HeartbeatHttpApi.save")(function* (ctx: {

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

          return yield* readState(directory)

        }),
      )

    })



    const init = Effect.fn("HeartbeatHttpApi.init")(function* () {

      return yield* withProjectDirectory((directory) =>
        Effect.gen(function* () {

          const fs = yield* AppFileSystem.Service

          const file = heartbeatPath(directory)

          if (yield* fs.existsSafe(file)) return yield* readState(directory)

          yield* fs.writeWithDirs(file, defaultHeartbeatTemplate)

          return yield* readState(directory)

        }),
      )

    })



    return handlers.handle("state", state).handle("save", save).handle("init", init)

  }),

)


