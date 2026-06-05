import { createSignal } from "solid-js"
import { useLanguage } from "@/context/language"
import { toggleHubResource } from "@/utils/hub-api"
import { showHubMutationError } from "./mutation-error"
import type { HubHttpOpts } from "./use-project-hub"

export function useHubResourceToggle(input: {
  httpOpts: () => HubHttpOpts
  onChanged: () => void
}) {
  const language = useLanguage()
  const [busy, setBusy] = createSignal<string | undefined>()

  const toggle = async (type: "persona" | "skill" | "mcp", ref: string, enabled: boolean) => {
    const opts = input.httpOpts()
    if (!opts.directory || !opts.baseUrl) return
    const key = `${type}:${ref}`
    setBusy(key)
    try {
      await toggleHubResource({ ...opts, type, ref, enabled })
      input.onChanged()
    } catch (error) {
      showHubMutationError(language.t("common.requestFailed"), error)
    } finally {
      setBusy(undefined)
    }
  }

  return { busy, toggle }
}
