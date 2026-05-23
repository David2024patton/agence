import { Effect } from "effect"

export interface LocalServer {
  name: string
  port: number
  url: string
  providerID: string
  probeEndpoint: string
  modelParser: (data: unknown) => LocalModel[]
}

export interface LocalModel {
  id: string
  name: string
  parameterSize?: string
  contextLength?: number
}

const SERVERS: LocalServer[] = [
  {
    name: "Ollama",
    port: 11434,
    url: "http://127.0.0.1:11434/v1",
    providerID: "ollama",
    probeEndpoint: "/api/tags",
    modelParser: (data: unknown) => {
      const models = (data as { models?: Array<{ name: string; details?: { parameter_size?: string; family?: string } }> })?.models ?? []
      return models.map((m) => ({
        id: m.name,
        name: m.details?.family ? `${m.details.family} ${m.name}` : m.name,
        parameterSize: m.details?.parameter_size,
      }))
    },
  },
  {
    name: "LM Studio",
    port: 1234,
    url: "http://127.0.0.1:1234/v1",
    providerID: "lmstudio",
    probeEndpoint: "/v1/models",
    modelParser: (data: unknown) => {
      const list = (data as { data?: Array<{ id: string }> })?.data ?? []
      return list.map((m) => ({ id: m.id, name: m.id }))
    },
  },
  {
    name: "vLLM",
    port: 8000,
    url: "http://127.0.0.1:8000/v1",
    providerID: "vllm",
    probeEndpoint: "/v1/models",
    modelParser: (data: unknown) => {
      const list = (data as { data?: Array<{ id: string }> })?.data ?? []
      return list.map((m) => ({ id: m.id, name: m.id }))
    },
  },
  {
    name: "LocalAI",
    port: 8080,
    url: "http://127.0.0.1:8080/v1",
    providerID: "localai",
    probeEndpoint: "/v1/models",
    modelParser: (data: unknown) => {
      const list = (data as { data?: Array<{ id: string }> })?.data ?? []
      return list.map((m) => ({ id: m.id, name: m.id }))
    },
  },
  {
    name: "llama.cpp",
    port: 8081,
    url: "http://127.0.0.1:8081/v1",
    providerID: "llamacpp",
    probeEndpoint: "/v1/models",
    modelParser: (data: unknown) => {
      const list = (data as { data?: Array<{ id: string }> })?.data ?? []
      return list.map((m) => ({ id: m.id, name: m.id }))
    },
  },
  {
    name: "Oobabooga",
    port: 5000,
    url: "http://127.0.0.1:5000/v1",
    providerID: "oobabooga",
    probeEndpoint: "/v1/models",
    modelParser: (data: unknown) => {
      const list = (data as { data?: Array<{ id: string }> })?.data ?? []
      return list.map((m) => ({ id: m.id, name: m.id }))
    },
  },
  {
    name: "Jan",
    port: 1337,
    url: "http://127.0.0.1:1337/v1",
    providerID: "jan",
    probeEndpoint: "/v1/models",
    modelParser: (data: unknown) => {
      const list = (data as { data?: Array<{ id: string }> })?.data ?? []
      return list.map((m) => ({ id: m.id, name: m.id }))
    },
  },
]

type DiscoveredServer = { server: LocalServer; models: LocalModel[]; url: string }

export function discoverLocalServers(signal?: AbortSignal): Effect.Effect<DiscoveredServer[]> {
  return Effect.gen(function* () {
    const results: DiscoveredServer[] = []

    yield* Effect.forEach(SERVERS, (server) =>
      Effect.gen(function* () {
        const probeUrl = `${server.url}${server.probeEndpoint}`
        if (signal?.aborted) return

        const text = yield* Effect.promise(() =>
          fetch(probeUrl, { signal: AbortSignal.timeout(3000) }).then((r) => r.text()),
        ).pipe(Effect.catch(() => Effect.succeed("")))

        if (!text || text.includes("ECONNREFUSED") || text.includes("ENOTFOUND")) return

        try {
          const data = JSON.parse(text)
          const models = server.modelParser(data)
          if (models.length > 0) {
            results.push({ server, models, url: server.url })
          }
        } catch {
          // Non-JSON response, skip
        }
      }),
      { concurrency: "unbounded" },
    )

    return results
  })
}

export const LOCAL_PROVIDER_NAMES: Record<string, { npm: string; name: string }> = {
  ollama: { npm: "@ai-sdk/openai-compatible", name: "Ollama" },
  lmstudio: { npm: "@ai-sdk/openai-compatible", name: "LM Studio" },
  vllm: { npm: "@ai-sdk/openai-compatible", name: "vLLM" },
  localai: { npm: "@ai-sdk/openai-compatible", name: "LocalAI" },
  llamacpp: { npm: "@ai-sdk/openai-compatible", name: "llama.cpp" },
  oobabooga: { npm: "@ai-sdk/openai-compatible", name: "Oobabooga" },
  jan: { npm: "@ai-sdk/openai-compatible", name: "Jan" },
}
