import { Config } from "effect"

function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

const AGENCE_EXPERIMENTAL = truthy("AGENCE_EXPERIMENTAL")
const copy = process.env["AGENCE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]

export const Flag = {
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"],
  OTEL_EXPORTER_OTLP_HEADERS: process.env["OTEL_EXPORTER_OTLP_HEADERS"],

  AGENCE_AUTO_HEAP_SNAPSHOT: truthy("AGENCE_AUTO_HEAP_SNAPSHOT"),
  AGENCE_GIT_BASH_PATH: process.env["AGENCE_GIT_BASH_PATH"],
  AGENCE_CONFIG: process.env["AGENCE_CONFIG"],
  AGENCE_CONFIG_CONTENT: process.env["AGENCE_CONFIG_CONTENT"],
  AGENCE_DISABLE_AUTOUPDATE: truthy("AGENCE_DISABLE_AUTOUPDATE"),
  AGENCE_ALWAYS_NOTIFY_UPDATE: truthy("AGENCE_ALWAYS_NOTIFY_UPDATE"),
  AGENCE_DISABLE_PRUNE: truthy("AGENCE_DISABLE_PRUNE"),
  AGENCE_DISABLE_TERMINAL_TITLE: truthy("AGENCE_DISABLE_TERMINAL_TITLE"),
  AGENCE_SHOW_TTFD: truthy("AGENCE_SHOW_TTFD"),
  AGENCE_DISABLE_AUTOCOMPACT: truthy("AGENCE_DISABLE_AUTOCOMPACT"),
  AGENCE_DISABLE_MODELS_FETCH: truthy("AGENCE_DISABLE_MODELS_FETCH"),
  AGENCE_DISABLE_MOUSE: truthy("AGENCE_DISABLE_MOUSE"),
  AGENCE_FAKE_VCS: process.env["AGENCE_FAKE_VCS"],
  AGENCE_SERVER_PASSWORD: process.env["AGENCE_SERVER_PASSWORD"],
  AGENCE_SERVER_USERNAME: process.env["AGENCE_SERVER_USERNAME"],

  // Experimental
  AGENCE_EXPERIMENTAL_FILEWATCHER: Config.boolean("AGENCE_EXPERIMENTAL_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  AGENCE_EXPERIMENTAL_DISABLE_FILEWATCHER: Config.boolean("AGENCE_EXPERIMENTAL_DISABLE_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  AGENCE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT:
    copy === undefined ? process.platform === "win32" : truthy("AGENCE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"),
  AGENCE_MODELS_URL: process.env["AGENCE_MODELS_URL"],
  AGENCE_MODELS_PATH: process.env["AGENCE_MODELS_PATH"],
  AGENCE_DB: process.env["AGENCE_DB"],

  AGENCE_WORKSPACE_ID: process.env["AGENCE_WORKSPACE_ID"],
  AGENCE_EXPERIMENTAL_WORKSPACES: AGENCE_EXPERIMENTAL || truthy("AGENCE_EXPERIMENTAL_WORKSPACES"),

  // Evaluated at access time (not module load) because tests, the CLI, and
  // external tooling set these env vars at runtime.
  get AGENCE_DISABLE_PROJECT_CONFIG() {
    return truthy("AGENCE_DISABLE_PROJECT_CONFIG")
  },
  get AGENCE_TUI_CONFIG() {
    return process.env["AGENCE_TUI_CONFIG"]
  },
  get AGENCE_CONFIG_DIR() {
    return process.env["AGENCE_CONFIG_DIR"]
  },
  get AGENCE_PURE() {
    return truthy("AGENCE_PURE")
  },
  get AGENCE_PERMISSION() {
    return process.env["AGENCE_PERMISSION"]
  },
  get AGENCE_PLUGIN_META_FILE() {
    return process.env["AGENCE_PLUGIN_META_FILE"]
  },
  get AGENCE_CLIENT() {
    return process.env["AGENCE_CLIENT"] ?? "cli"
  },
}
