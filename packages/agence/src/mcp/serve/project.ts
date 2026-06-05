import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js"
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js"
import { Effect } from "effect"
import { AppRuntime, type AppServices } from "@/effect/app-runtime"
import { InstanceRef } from "@/effect/instance-ref"
import { Agent } from "@/agent/agent"
import { ProjectHub } from "@/project/hub"
import { savePersona } from "@/project/persona"
import { registerProject } from "@/project/projects-index"
import { searchLearnings, storeLearning } from "@/learning/index"
import { MCP } from "@/mcp"

type McpToolProxy = {
  id: string
  server: string
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

function textResult(text: string, isError = false): CallToolResult {
  return { content: [{ type: "text", text }], ...(isError ? { isError: true } : {}) }
}

function parseArgs(raw: unknown) {
  if (!raw || typeof raw !== "object") return {} as Record<string, unknown>
  return raw as Record<string, unknown>
}

export function runProjectMcpServe(directory: string) {
  return Effect.gen(function* () {
    const ctx = yield* InstanceRef
    if (!ctx) return yield* Effect.die("InstanceRef required for project MCP serve")
    const projectId = ctx.project.id as string
    const runInInstance = <A, E>(effect: Effect.Effect<A, E, AppServices>) =>
      AppRuntime.runPromise(effect.pipe(Effect.provideService(InstanceRef, ctx)))

    yield* registerProject(directory)
    const hub = yield* ProjectHub.getHubState(directory)
    const mcpSvc = yield* MCP.Service
    const mcpClients = yield* mcpSvc.clients()
    const mcpStatuses = yield* mcpSvc.status()

    const agentSvc = yield* Agent.Service
    const personaId = hub.manifest.persona_id ?? "build"
    const persona = yield* agentSvc.get(personaId).pipe(Effect.catch(() => agentSvc.defaultInfo()))
    const personaText = persona.prompt ?? persona.description ?? persona.name

    const proxies: McpToolProxy[] = []
    for (const [server, client] of Object.entries(mcpClients)) {
      const status = mcpStatuses[server]
      if (!status || status.status !== "connected") continue
      const listed = yield* Effect.tryPromise(() => client.listTools()).pipe(Effect.catch(() => Effect.succeed(undefined)))
      if (!listed?.tools) continue
      for (const tool of listed.tools) {
        const id = `mcp__${server}__${tool.name}`.replace(/[^a-zA-Z0-9_]/g, "_")
        proxies.push({
          id,
          server,
          name: tool.name,
          description: tool.description ?? tool.name,
          inputSchema: (tool.inputSchema as Record<string, unknown>) ?? { type: "object", properties: {} },
        })
      }
    }

    const server = new Server(
      { name: "agence-project", version: "1.0.0" },
      { capabilities: { tools: {}, resources: {} } },
    )

    server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        { uri: "agence://project/manifest", name: "Project manifest", mimeType: "application/json" },
        { uri: "agence://project/hub", name: "Project hub state", mimeType: "application/json" },
        { uri: "agence://project/persona", name: "Active persona prompt", mimeType: "text/plain" },
        { uri: "agence://project/directory", name: "Project directory", mimeType: "text/plain" },
      ],
    }))

    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri
      if (uri === "agence://project/manifest") {
        return {
          contents: [{ uri, mimeType: "application/json", text: JSON.stringify(hub.manifest, null, 2) }],
        }
      }
      if (uri === "agence://project/hub") {
        return {
          contents: [{ uri, mimeType: "application/json", text: JSON.stringify(hub, null, 2) }],
        }
      }
      if (uri === "agence://project/persona") {
        return {
          contents: [{ uri, mimeType: "text/plain", text: personaText || hub.manifest.persona_id || "build" }],
        }
      }
      if (uri === "agence://project/directory") {
        return {
          contents: [{ uri, mimeType: "text/plain", text: directory }],
        }
      }
      throw new Error(`Unknown resource: ${uri}`)
    })

    const hubTools = [
      {
        name: "agence_hub_state",
        description: "Full project hub: personas, skills, MCPs, bundles, threads.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "agence_set_persona",
        description: "Set the active persona for this project (built-in id or custom slug).",
        inputSchema: {
          type: "object",
          properties: { persona_id: { type: "string", description: "Persona id" } },
          required: ["persona_id"],
        },
      },
      {
        name: "agence_save_persona",
        description: "Create or update a custom persona saved to .agence/agents/.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            prompt: { type: "string" },
            activate: { type: "boolean" },
            id: { type: "string", description: "Existing persona id when editing" },
          },
          required: ["name", "prompt"],
        },
      },
      {
        name: "agence_set_goal",
        description: "Update the project goal in project.json.",
        inputSchema: {
          type: "object",
          properties: { goal: { type: "string" } },
          required: ["goal"],
        },
      },
      {
        name: "agence_memory_recall",
        description: "Semantic search over this project's memory database.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            limit: { type: "number" },
          },
          required: ["query"],
        },
      },
      {
        name: "agence_memory_add",
        description: "Store a learning in this project's memory database.",
        inputSchema: {
          type: "object",
          properties: {
            concept: { type: "string" },
            description: { type: "string" },
            layer: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
          },
          required: ["concept", "description"],
        },
      },
    ]

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        ...hubTools,
        ...proxies.map((tool) => ({
          name: tool.id,
          description: `[${tool.server}] ${tool.description}`,
          inputSchema: tool.inputSchema,
        })),
      ],
    }))

    server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
      const args = parseArgs(request.params.arguments)
      const name = request.params.name

      if (name === "agence_hub_state") {
        const fresh = await runInInstance(ProjectHub.getHubState(directory))
        return textResult(JSON.stringify(fresh, null, 2))
      }

      if (name === "agence_set_persona") {
        const personaId = String(args.persona_id ?? "")
        if (!personaId) return textResult("persona_id is required", true)
        await runInInstance(ProjectHub.updateManifest(directory, { persona_id: personaId }))
        return textResult(`Active persona set to ${personaId}`)
      }

      if (name === "agence_save_persona") {
        const prompt = String(args.prompt ?? "")
        const displayName = String(args.name ?? "")
        if (!displayName || !prompt) return textResult("name and prompt are required", true)
        const result = await runInInstance(
          savePersona(directory, {
            id: typeof args.id === "string" ? args.id : undefined,
            name: displayName,
            description: typeof args.description === "string" ? args.description : undefined,
            prompt,
            activate: args.activate === true,
          }),
        )
        await runInInstance(ProjectHub.getHubState(directory))
        return textResult(JSON.stringify(result, null, 2))
      }

      if (name === "agence_set_goal") {
        const goal = String(args.goal ?? "")
        await runInInstance(ProjectHub.updateManifest(directory, { goal }))
        return textResult("Goal saved")
      }

      if (name === "agence_memory_recall") {
        const query = String(args.query ?? "")
        const limit = typeof args.limit === "number" ? args.limit : 8
        const hits = await runInInstance(
          searchLearnings({ projectId, query, limit, includeGlobal: true }),
        )
        return textResult(JSON.stringify(hits, null, 2))
      }

      if (name === "agence_memory_add") {
        const concept = String(args.concept ?? "")
        const description = String(args.description ?? "")
        const layer = typeof args.layer === "string" ? args.layer : "context"
        const tags = Array.isArray(args.tags) ? (args.tags as string[]) : undefined
        const id = await runInInstance(
          storeLearning({
            projectId,
            source: "mcp",
            concept,
            description,
            confidence: "medium",
            metadata: { layer, tags, reason: "mcp-serve" },
          }),
        )
        return textResult(JSON.stringify({ id }, null, 2))
      }

      const proxy = proxies.find((item) => item.id === name)
      if (proxy) {
        const client = mcpClients[proxy.server]
        if (!client) return textResult(`MCP server not connected: ${proxy.server}`, true)
        const result = await client.callTool(
          { name: proxy.name, arguments: args },
          CallToolResultSchema,
          { timeout: 60_000 },
        )
        const parts = Array.isArray(result.content) ? result.content : []
        const text =
          parts
            .map((part) =>
              part && typeof part === "object" && "type" in part && part.type === "text" && "text" in part
                ? String(part.text)
                : JSON.stringify(part),
            )
            .join("\n") || JSON.stringify(result)
        return textResult(text, result.isError === true)
      }

      return textResult(`Unknown tool: ${name}`, true)
    })

    const transport = new StdioServerTransport()
    yield* Effect.tryPromise(() => server.connect(transport))
    yield* Effect.log(`Agence project MCP server running for ${directory}`)
    yield* Effect.never
  })
}
