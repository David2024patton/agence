import { Schema } from "effect"

// Directories config: baseDir for self-contained installs, plus additional
// watch directories for MCP servers, skills, and custom tools.
// Configured in opencode.jsonc under the "directories" key.

export const Info = Schema.Struct({
  baseDir: Schema.optional(Schema.String).annotate({
    description:
      "Self-contained base directory. When set, the program scans baseDir/skills/, baseDir/mcp/, and baseDir/tools/ in addition to default paths",
  }),
  mcp: Schema.optional(Schema.Array(Schema.String)).annotate({
    description: "Additional directories to scan for MCP server configs",
  }),
  skills: Schema.optional(Schema.Array(Schema.String)).annotate({
    description: "Additional directories to scan for skill files",
  }),
  tools: Schema.optional(Schema.Array(Schema.String)).annotate({
    description: "Additional directories to scan for custom tools",
  }),
})

export type Info = Schema.Schema.Type<typeof Info>

export * as ConfigDirectories from "./directories"
