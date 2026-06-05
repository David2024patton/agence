import { Button } from "@agence-ai/ui/button"
import { useDialog } from "@agence-ai/ui/context/dialog"
import { Dialog } from "@agence-ai/ui/dialog"
import { Icon } from "@agence-ai/ui/icon"
import { createSignal } from "solid-js"
import { useGlobalSDK } from "@/context/global-sdk"
import { usePlatform } from "@/context/platform"
import { useLayout, type LocalProject } from "@/context/layout"
import { getFilename } from "@agence-ai/core/util/path"
import { useServer } from "@/context/server"

export function DialogProjectMissing(props: { project: LocalProject }) {
  const dialog = useDialog()
  const globalSDK = useGlobalSDK()
  const platform = usePlatform()
  const layout = useLayout()
  const server = useServer()
  const [relocating, setRelocating] = createSignal(false)
  const [error, setError] = createSignal<string | undefined>()

  const projectName = () => props.project.name || getFilename(props.project.worktree)
  const missingPath = () => props.project.worktree

  async function browse() {
    if (relocating()) return
    if (!platform.openDirectoryPickerDialog) return

    const result = await platform.openDirectoryPickerDialog({
      title: "Locate project folder",
    })
    const chosen = Array.isArray(result) ? result[0] : result
    if (!chosen) return

    const id = props.project.id
    if (!id || id === "global") {
      setError("Cannot relocate this project (no ID).")
      return
    }

    setRelocating(true)
    setError(undefined)

    const current = server.current
    if (!current) {
      setError("No server connection.")
      setRelocating(false)
      return
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" }
    const pw = current.http.password
    if (pw) headers["Authorization"] = `Basic ${btoa(`${current.http.username ?? "agence"}:${pw}`)}`

    const res = await fetch(`${current.http.url}/project/${encodeURIComponent(id)}/relocate`, {
      method: "POST",
      headers,
      body: JSON.stringify({ directory: chosen }),
    }).catch(() => null)

    setRelocating(false)

    if (!res || !res.ok) {
      setError(`Failed to relocate project (${res?.status ?? "network error"}).`)
      return
    }

    dialog.close()
    layout.projects.close(missingPath())
    layout.projects.open(chosen)
  }

  function remove() {
    layout.projects.close(missingPath())
    dialog.close()
  }

  return (
    <Dialog title="Project folder not found" fit>
      <div class="flex flex-col gap-4 pl-6 pr-2.5 pb-4">
        <div class="flex items-start gap-3">
          <div class="mt-0.5 shrink-0 flex items-center justify-center size-8 rounded-md bg-surface-warning-base text-icon-warning-base">
            <Icon name="warning" size="small" />
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-14-medium text-text-strong">{projectName()}</span>
            <span class="text-12-regular text-text-weak font-mono break-all">{missingPath()}</span>
            <span class="text-12-regular text-text-weak mt-1">
              This project's folder could not be found. The drive letter may have changed, or the folder was moved or
              deleted. Browse to locate it, or remove it from your project list.
            </span>
          </div>
        </div>

        {error() && (
          <div class="rounded-md px-3 py-2 bg-surface-error-base text-12-regular text-text-error-base">{error()}</div>
        )}

        <div class="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="large" onClick={remove}>
            Remove from list
          </Button>
          <Button variant="primary" size="large" disabled={relocating() || !platform.openDirectoryPickerDialog} onClick={() => void browse()}>
            {relocating() ? "Locating..." : "Browse..."}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
