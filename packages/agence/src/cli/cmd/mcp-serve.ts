import { effectCmd, fail } from "../effect-cmd"
import { Effect } from "effect"
import { McpServe } from "../../mcp/serve"
import { resolveMcpServeMode } from "../../mcp/serve"

export const McpServeCommand = effectCmd({
  command: "serve",
  describe: "expose Agence as an MCP server (global project list, or per-project hub/tools)",
  builder: (yargs) =>
    yargs
      .option("directory", {
        alias: "d",
        type: "string",
        describe: "Project directory (per-project hub, tools, memory, proxied MCPs)",
      })
      .option("global", {
        type: "boolean",
        describe: "List all known projects (no project directory required)",
        default: false,
      }),
  instance: (args) => {
    const mode = resolveMcpServeMode({
      directory: args.directory,
      global: args.global === true,
    })
    return mode.mode === "project"
  },
  directory: (args) => {
    const mode = resolveMcpServeMode({
      directory: args.directory,
      global: args.global === true,
    })
    return mode.mode === "project" ? mode.directory : process.cwd()
  },
  handler: Effect.fn("Cli.mcp.serve")(function* (args) {
    yield* (McpServe.runMcpServe({
      directory: args.directory,
      global: args.global === true,
    }) as Effect.Effect<any, any, any>).pipe(
      Effect.catch((error) => fail(String(error))),
    )
  }),
})
