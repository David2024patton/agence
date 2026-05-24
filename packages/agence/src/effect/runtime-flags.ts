import { Config, ConfigProvider, Context, Effect, Layer } from "effect"
import { ConfigService } from "@/effect/config-service"

const bool = (name: string) => Config.boolean(name).pipe(Config.withDefault(false))
const positiveInteger = (name: string) =>
  Config.number(name).pipe(
    Config.map((value) => (Number.isInteger(value) && value > 0 ? value : undefined)),
    Config.orElse(() => Config.succeed(undefined)),
  )
const experimental = bool("AGENCE_EXPERIMENTAL")
const enabledByExperimental = (name: string) =>
  Config.all({ experimental, enabled: bool(name) }).pipe(Config.map((flags) => flags.experimental || flags.enabled))

export class Service extends ConfigService.Service<Service>()("@agence/RuntimeFlags", {
  autoShare: bool("AGENCE_AUTO_SHARE"),
  pure: bool("AGENCE_PURE"),
  disableDefaultPlugins: bool("AGENCE_DISABLE_DEFAULT_PLUGINS"),
  disableChannelDb: bool("AGENCE_DISABLE_CHANNEL_DB"),
  disableEmbeddedWebUi: bool("AGENCE_DISABLE_EMBEDDED_WEB_UI"),
  disableExternalSkills: bool("AGENCE_DISABLE_EXTERNAL_SKILLS"),
  disableLspDownload: bool("AGENCE_DISABLE_LSP_DOWNLOAD"),
  skipMigrations: bool("AGENCE_SKIP_MIGRATIONS"),
  disableClaudeCodePrompt: Config.all({
    broad: bool("AGENCE_DISABLE_CLAUDE_CODE"),
    direct: bool("AGENCE_DISABLE_CLAUDE_CODE_PROMPT"),
  }).pipe(Config.map((flags) => flags.broad || flags.direct)),
  disableClaudeCodeSkills: Config.all({
    broad: bool("AGENCE_DISABLE_CLAUDE_CODE"),
    direct: bool("AGENCE_DISABLE_CLAUDE_CODE_SKILLS"),
  }).pipe(Config.map((flags) => flags.broad || flags.direct)),
  enableExa: Config.all({
    experimental,
    enabled: bool("AGENCE_ENABLE_EXA"),
    legacy: bool("AGENCE_EXPERIMENTAL_EXA"),
  }).pipe(Config.map((flags) => flags.experimental || flags.enabled || flags.legacy)),
  enableParallel: Config.all({
    enabled: bool("AGENCE_ENABLE_PARALLEL"),
    legacy: bool("AGENCE_EXPERIMENTAL_PARALLEL"),
  }).pipe(Config.map((flags) => flags.enabled || flags.legacy)),
  enableExperimentalModels: bool("AGENCE_ENABLE_EXPERIMENTAL_MODELS"),
  enableQuestionTool: bool("AGENCE_ENABLE_QUESTION_TOOL"),
  experimentalScout: enabledByExperimental("AGENCE_EXPERIMENTAL_SCOUT"),
  experimentalBackgroundSubagents: enabledByExperimental("AGENCE_EXPERIMENTAL_BACKGROUND_SUBAGENTS"),
  experimentalLspTy: bool("AGENCE_EXPERIMENTAL_LSP_TY"),
  experimentalLspTool: enabledByExperimental("AGENCE_EXPERIMENTAL_LSP_TOOL"),
  experimentalOxfmt: enabledByExperimental("AGENCE_EXPERIMENTAL_OXFMT"),
  experimentalPlanMode: enabledByExperimental("AGENCE_EXPERIMENTAL_PLAN_MODE"),
  experimentalEventSystem: enabledByExperimental("AGENCE_EXPERIMENTAL_EVENT_SYSTEM"),
  experimentalWorkspaces: enabledByExperimental("AGENCE_EXPERIMENTAL_WORKSPACES"),
  experimentalIconDiscovery: enabledByExperimental("AGENCE_EXPERIMENTAL_ICON_DISCOVERY"),
  outputTokenMax: positiveInteger("AGENCE_EXPERIMENTAL_OUTPUT_TOKEN_MAX"),
  bashDefaultTimeoutMs: positiveInteger("AGENCE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS"),
  experimentalNativeLlm: enabledByExperimental("AGENCE_EXPERIMENTAL_NATIVE_LLM"),
  client: Config.string("AGENCE_CLIENT").pipe(Config.withDefault("cli")),
}) {}

export type Info = Context.Service.Shape<typeof Service>

const emptyConfigLayer = Service.defaultLayer.pipe(
  Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({}))),
  Layer.orDie,
)

export const layer = (overrides: Partial<Info> = {}) =>
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const flags = yield* Service
      return Service.of({ ...flags, ...overrides })
    }),
  ).pipe(Layer.provide(emptyConfigLayer))

export const defaultLayer = Service.defaultLayer.pipe(Layer.orDie)

export * as RuntimeFlags from "./runtime-flags"
