import type { ServerConnection } from "@/context/server"
import { authTokenFromCredentials } from "@/utils/server"

export async function instanceHttpRequest<T = unknown>(input: {
  baseUrl: string
  server?: ServerConnection.Any | null
  directory?: string
  method: "GET" | "POST"
  path: string
  body?: unknown
  fetch?: typeof fetch
}): Promise<T> {
  const root = input.baseUrl.replace(/\/+$/, "")
  const url = new URL(`${root}${input.path.startsWith("/") ? input.path : `/${input.path}`}`)
  if (input.directory) url.searchParams.set("directory", input.directory)

  const headers: Record<string, string> = {}
  if (input.method === "POST") headers["Content-Type"] = "application/json"

  const http = input.server && "http" in input.server ? input.server.http : undefined
  if (http?.password) {
    headers.Authorization = `Basic ${authTokenFromCredentials({
      username: http.username,
      password: http.password,
    })}`
  }
  if (input.directory) headers["x-opencode-directory"] = encodeURIComponent(input.directory)

  const res = await (input.fetch ?? fetch)(url.toString(), {
    method: input.method,
    headers,
    body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
  })

  const body = await res.text()
  if (!res.ok) {
    let message: string | undefined
    if (body.trimStart().startsWith("{")) {
      try {
        const parsed = JSON.parse(body) as { message?: string; data?: { message?: string } }
        message = parsed.message ?? parsed.data?.message
      } catch {
        // ignore malformed JSON error bodies
      }
    }
    throw new Error(message ?? `HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  if (res.status === 204 || !body.trim()) return undefined as T

  const trimmed = body.trimStart()
  if (trimmed.startsWith("<")) {
    throw new Error(
      `API route ${input.path} returned HTML instead of JSON. Restart Agence Desktop so the sidecar rebuilds (bun dev:desktop from the repo), or install a build that includes Learning settings APIs.`,
    )
  }

  try {
    return JSON.parse(body) as T
  } catch {
    throw new Error(`Invalid JSON from ${input.path}: ${body.slice(0, 160)}`)
  }
}
