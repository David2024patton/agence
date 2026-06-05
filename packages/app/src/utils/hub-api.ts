import { instanceHttpRequest } from "./instance-http"

export type HubState = {
  directory: string
  manifest: {
    persona_id?: string
    default_model?: string
    goal?: string
    enabled_groups?: string[]
    max_parallel_agents?: number
  }
  groups: Array<{
    id: string
    name: string
    description?: string
    builtin?: boolean
    enabled?: boolean
    items: Array<{ type: string; ref: string }>
  }>
  effective: Array<{ type: string; ref: string }>
  personas: Array<{ id: string; name: string; description?: string; mode?: string; active: boolean; custom?: boolean; enabled: boolean; locked?: boolean }>
  skills: Array<{ id: string; name: string; description?: string; location: string; enabled: boolean; locked?: boolean }>
  mcps: Array<{ id: string; name: string; status: string; type: string; enabled: boolean }>
  threads: Array<{ id: string; title: string; parentID?: string; updated?: number; kind: "session" | "subagent" }>
  mcpServe: { stdio: string; global?: string; note: string }
  goal?: { status: string; continuationCount: number; budget: number }
}

export function normalizeHubState(raw: Partial<HubState> & Pick<HubState, "directory">): HubState {
  return {
    directory: raw.directory,
    manifest: raw.manifest ?? {},
    groups: raw.groups ?? [],
    effective: raw.effective ?? [],
    personas: raw.personas ?? [],
    skills: raw.skills ?? [],
    mcps: raw.mcps ?? [],
    threads: raw.threads ?? [],
    mcpServe: raw.mcpServe ?? {
      stdio: "agence mcp serve --directory <path>",
      note: "Per-project MCP server",
    },
    goal: raw.goal,
  }
}

export async function fetchHubState(input: {
  baseUrl: string
  directory: string
  server?: Parameters<typeof instanceHttpRequest>[0]["server"]
  fetch?: typeof fetch
}) {
  return normalizeHubState(
    await instanceHttpRequest<HubState>({
      baseUrl: input.baseUrl,
      directory: input.directory,
      server: input.server,
      fetch: input.fetch,
      method: "GET",
      path: "/hub/state",
    }),
  )
}

export async function updateHubManifest(input: {
  baseUrl: string
  directory: string
  server?: Parameters<typeof instanceHttpRequest>[0]["server"]
  fetch?: typeof fetch
  manifest: Partial<HubState["manifest"]>
}) {
  return instanceHttpRequest({
    baseUrl: input.baseUrl,
    directory: input.directory,
    server: input.server,
    fetch: input.fetch,
    method: "POST",
    path: "/hub/manifest",
    body: input.manifest,
  })
}

export async function toggleHubGroup(input: {
  baseUrl: string
  directory: string
  server?: Parameters<typeof instanceHttpRequest>[0]["server"]
  fetch?: typeof fetch
  groupID: string
  enabled: boolean
}) {
  return instanceHttpRequest({
    baseUrl: input.baseUrl,
    directory: input.directory,
    server: input.server,
    fetch: input.fetch,
    method: "POST",
    path: "/hub/groups/toggle",
    body: { groupID: input.groupID, enabled: input.enabled },
  })
}

export async function installFromGithub(input: {
  baseUrl: string
  directory: string
  server?: Parameters<typeof instanceHttpRequest>[0]["server"]
  fetch?: typeof fetch
  type: "persona" | "skill" | "mcp" | "plugin"
  github: string
  subpath?: string
  name?: string
}) {
  return instanceHttpRequest({
    baseUrl: input.baseUrl,
    directory: input.directory,
    server: input.server,
    fetch: input.fetch,
    method: "POST",
    path: "/hub/install/github",
    body: {
      type: input.type,
      github: input.github,
      subpath: input.subpath,
      name: input.name,
    },
  })
}

export async function uploadHubResource(input: {
  baseUrl: string
  directory: string
  server?: Parameters<typeof instanceHttpRequest>[0]["server"]
  fetch?: typeof fetch
  type: "persona" | "skill" | "mcp" | "plugin"
  name: string
  content: string
}) {
  return instanceHttpRequest({
    baseUrl: input.baseUrl,
    directory: input.directory,
    server: input.server,
    fetch: input.fetch,
    method: "POST",
    path: "/hub/upload",
    body: {
      type: input.type,
      name: input.name,
      content: input.content,
    },
  })
}

export async function saveHubPersona(input: {
  baseUrl: string
  directory: string
  server?: Parameters<typeof instanceHttpRequest>[0]["server"]
  fetch?: typeof fetch
  id?: string
  name: string
  description?: string
  mode?: "primary" | "subagent" | "all"
  prompt: string
  activate?: boolean
}) {
  return instanceHttpRequest<{ id: string; name: string; path?: string }>({
    baseUrl: input.baseUrl,
    directory: input.directory,
    server: input.server,
    fetch: input.fetch,
    method: "POST",
    path: "/hub/persona/save",
    body: {
      id: input.id,
      name: input.name,
      description: input.description,
      mode: input.mode,
      prompt: input.prompt,
      activate: input.activate,
    },
  })
}

export async function fetchHubPersona(input: {
  baseUrl: string
  directory: string
  personaID: string
  server?: Parameters<typeof instanceHttpRequest>[0]["server"]
  fetch?: typeof fetch
}) {
  return instanceHttpRequest<{
    id: string
    name: string
    description?: string
    mode?: string
    prompt: string
  }>({
    baseUrl: input.baseUrl,
    directory: input.directory,
    server: input.server,
    fetch: input.fetch,
    method: "GET",
    path: `/hub/persona?personaID=${encodeURIComponent(input.personaID)}`,
  })
}

export async function toggleHubResource(input: {
  baseUrl: string
  directory: string
  server?: Parameters<typeof instanceHttpRequest>[0]["server"]
  fetch?: typeof fetch
  type: "persona" | "skill" | "mcp" | "plugin"
  ref: string
  enabled: boolean
}) {
  return normalizeHubState(
    await instanceHttpRequest<HubState>({
      baseUrl: input.baseUrl,
      directory: input.directory,
      server: input.server,
      fetch: input.fetch,
      method: "POST",
      path: "/hub/resource/toggle",
      body: {
        type: input.type,
        ref: input.ref,
        enabled: input.enabled,
      },
    }),
  )
}

export async function saveHubGroups(input: {
  baseUrl: string
  directory: string
  server?: Parameters<typeof instanceHttpRequest>[0]["server"]
  fetch?: typeof fetch
  groups: Array<{ id: string; name: string; description?: string; items: Array<{ type: string; ref: string }> }>
}) {
  return instanceHttpRequest({
    baseUrl: input.baseUrl,
    directory: input.directory,
    server: input.server,
    fetch: input.fetch,
    method: "POST",
    path: "/hub/groups/save",
    body: { groups: input.groups },
  })
}
