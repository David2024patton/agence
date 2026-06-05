import { createMemo, createResource } from "solid-js"
import { getFilename } from "@agence-ai/core/util/path"
import { useGlobalSDK } from "@/context/global-sdk"
import { useLayout } from "@/context/layout"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { displayName } from "@/pages/layout/helpers"
import { fetchHubState } from "@/utils/hub-api"

export type HubHttpOpts = {
  baseUrl: string
  directory: string
  server?: Parameters<typeof fetchHubState>[0]["server"]
  fetch?: typeof fetch
}

export function useProjectHub(directory: () => string) {
  const gsdk = useGlobalSDK()
  const platform = usePlatform()
  const server = useServer()
  const layout = useLayout()

  const httpOpts = () => ({
    baseUrl: gsdk.url,
    server: server.current,
    directory: directory(),
    fetch: platform.fetch,
  })

  const projectLabel = createMemo(() => {
    const dir = directory()
    if (!dir) return ""
    const project = layout.projects.list().find((item) => item.worktree === dir)
    if (project) return displayName(project)
    return getFilename(dir)
  })

  const [hub, hubActions] = createResource(
    () => ({ dir: directory(), base: gsdk.url }),
    async ({ dir, base }) => {
      if (!dir || !base) return undefined
      return fetchHubState({ ...httpOpts(), directory: dir, baseUrl: base })
    },
  )

  return {
    httpOpts,
    projectLabel,
    hub,
    refetch: hubActions.refetch,
  }
}
