import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js"
import { Effect } from "effect"
import { listKnownProjects, projectDisplayName } from "@/project/projects-index"

export function runGlobalMcpServe() {
  return Effect.gen(function* () {
    const projects = () => listKnownProjects()

    const server = new Server(
      { name: "agence-hub", version: "1.0.0" },
      { capabilities: { tools: {}, resources: {} } },
    )

    server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: "agence://projects/list",
          name: "All known Agence projects",
          mimeType: "application/json",
        },
      ],
    }))

    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      if (request.params.uri === "agence://projects/list") {
        const list = projects().map((item) => ({
          directory: item.directory,
          name: projectDisplayName(item),
          lastSeenMs: item.lastSeenMs,
          serveCommand: `agence mcp serve --directory ${JSON.stringify(item.directory)}`,
        }))
        return {
          contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(list, null, 2) }],
        }
      }
      throw new Error(`Unknown resource: ${request.params.uri}`)
    })

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "agence_list_projects",
          description: "List Agence projects known to the desktop app and project index.",
          inputSchema: { type: "object", properties: {} },
        },
      ],
    }))

    server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
      if (request.params.name === "agence_list_projects") {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                projects().map((item) => ({
                  name: projectDisplayName(item),
                  directory: item.directory,
                  mcpServe: `agence mcp serve --directory ${JSON.stringify(item.directory)}`,
                })),
                null,
                2,
              ),
            },
          ],
        }
      }
      return {
        content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
        isError: true,
      }
    })

    const transport = new StdioServerTransport()
    yield* Effect.tryPromise(() => server.connect(transport))
    yield* Effect.log("Agence global MCP server running (project list)")
    yield* Effect.never
  })
}
