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

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
