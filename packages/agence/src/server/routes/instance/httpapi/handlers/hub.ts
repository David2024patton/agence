import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Config } from "@/config/config"
import { ProjectHub } from "@/project/hub"
import { InstanceHttpApi } from "../api"
import { withProjectInstance } from "./instance-scope"

export const hubHandlers = HttpApiBuilder.group(InstanceHttpApi, "hub", (handlers) =>
  Effect.gen(function* () {
    const state = Effect.fn("HubHttpApi.state")(function* () {
      return yield* withProjectInstance((directory) => ProjectHub.getHubState(directory))
    })

    const updateManifest = Effect.fn("HubHttpApi.updateManifest")(function* (ctx: {
      payload: Parameters<typeof ProjectHub.updateManifest>[1]
    }) {
      return yield* withProjectInstance((directory) => ProjectHub.updateManifest(directory, ctx.payload))
    })

    const toggleGroup = Effect.fn("HubHttpApi.toggleGroup")(function* (ctx: {
      payload: { groupID: string; enabled: boolean }
    }) {
      return yield* withProjectInstance((directory) =>
        ProjectHub.toggleGroup(directory, ctx.payload.groupID, ctx.payload.enabled),
      )
    })

    const install = Effect.fn("HubHttpApi.install")(function* (ctx: {
      payload: Parameters<typeof ProjectHub.installResource>[1]
    }) {
      return yield* withProjectInstance((directory) => ProjectHub.installResource(directory, ctx.payload))
    })

    const upload = Effect.fn("HubHttpApi.upload")(function* (ctx: {
      payload: { type: Parameters<typeof ProjectHub.uploadResource>[1]["type"]; name: string; content: string }
    }) {
      return yield* withProjectInstance((directory) => ProjectHub.uploadResource(directory, ctx.payload))
    })

    const saveGroups = Effect.fn("HubHttpApi.saveGroups")(function* (ctx: {
      payload: { groups: Parameters<typeof ProjectHub.updateRegistryGroups>[1] }
    }) {
      return yield* withProjectInstance((directory) =>
        Effect.gen(function* () {
          const registry = yield* ProjectHub.updateRegistryGroups(directory, ctx.payload.groups)
          return { groups: registry.groups ?? [] }
        }),
      )
    })

    const savePersona = Effect.fn("HubHttpApi.savePersona")(function* (ctx: {
      payload: Parameters<typeof ProjectHub.savePersona>[1]
    }) {
      return yield* withProjectInstance((directory) => ProjectHub.savePersona(directory, ctx.payload))
    })

    const personaContent = Effect.fn("HubHttpApi.personaContent")(function* (ctx: {
      query: { personaID: string }
    }) {
      return yield* withProjectInstance((directory) => ProjectHub.loadPersonaContent(directory, ctx.query.personaID))
    })

    const toggleResource = Effect.fn("HubHttpApi.toggleResource")(function* (ctx: {
      payload: { type: "persona" | "skill" | "mcp" | "plugin"; ref: string; enabled: boolean }
    }) {
      return yield* withProjectInstance((directory) =>
        Effect.gen(function* () {
          const configSvc = yield* Config.Service
          const config = yield* configSvc.get()
          const mcpNames = Object.keys(config.mcp ?? {})
          yield* ProjectHub.toggleResource(directory, ctx.payload, mcpNames)
          return yield* ProjectHub.getHubState(directory)
        }),
      )
    })

    return handlers
      .handle("state", state)
      .handle("updateManifest", updateManifest)
      .handle("toggleGroup", toggleGroup)
      .handle("install", install)
      .handle("upload", upload)
      .handle("saveGroups", saveGroups)
      .handle("savePersona", savePersona)
      .handle("personaContent", personaContent)
      .handle("toggleResource", toggleResource)
  }),
)
