import { createMemo } from "solid-js"
import { useParams } from "@solidjs/router"
import { useSettingsProjectDirectory } from "@/context/settings-project"
import { useLayout } from "@/context/layout"
import { useGlobalSDK } from "@/context/global-sdk"
import { useServer } from "@/context/server"
import { usePlatform } from "@/context/platform"
import { decode64 } from "@/utils/base64"
import { instanceHttpRequest } from "@/utils/instance-http"

export function useSettingsWorkspaceDirectory() {
  const params = useParams()
  const layout = useLayout()
  const fromDialog = useSettingsProjectDirectory()
  return createMemo(() => {
    if (fromDialog) return fromDialog
    const fromRoute = decode64(params.dir)
    if (fromRoute) return fromRoute
    const projects = layout.projects.list()
    const expanded = projects.find((project) => project.expanded)
    if (expanded?.worktree) return expanded.worktree
    return undefined
  })
}

export function useLearningHttp() {
  const gsdk = useGlobalSDK()
  const server = useServer()
  const platform = usePlatform()
  const directory = useSettingsWorkspaceDirectory()

  const http = <T,>(input: { method: "GET" | "POST"; path: string; body?: unknown }) => {
    const dir = directory()
    if (!dir) return Promise.reject(new Error("Open a project first."))
    return instanceHttpRequest<T>({
      baseUrl: gsdk.url,
      server: server.current,
      directory: dir,
      fetch: platform.fetch,
      ...input,
    })
  }

  return { http, directory }
}
