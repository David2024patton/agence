import { createEffect, createSignal, Show, type Component } from "solid-js"
import { Button } from "@agence-ai/ui/button"
import { TextField } from "@agence-ai/ui/text-field"
import { useLanguage } from "@/context/language"
import { updateHubManifest } from "@/utils/hub-api"
import type { HubState } from "@/utils/hub-api"
import { HubPanel, HubSectionHint } from "./shared"
import { showHubMutationError } from "./mutation-error"
import type { HubHttpOpts } from "./use-project-hub"

export const ProjectHubGoalSection: Component<{
  state: HubState
  httpOpts: () => HubHttpOpts
  onChanged: () => void
}> = (props) => {
  const language = useLanguage()
  const [goal, setGoal] = createSignal("")
  const [dirty, setDirty] = createSignal(false)

  createEffect(() => {
    if (dirty()) return
    const value = props.state.manifest?.goal
    if (value !== undefined) setGoal(value)
  })

  const saveGoal = async () => {
    const opts = props.httpOpts()
    if (!opts.directory || !opts.baseUrl) return
    try {
      await updateHubManifest({ ...opts, manifest: { goal: goal() } })
      setDirty(false)
      props.onChanged()
    } catch (error) {
      showHubMutationError(language.t("common.requestFailed"), error)
    }
  }

  return (
    <div class="flex flex-col">
      <HubSectionHint>{language.t("hub.goal.description")}</HubSectionHint>
      <Show when={props.state.goal}>
        {(runtime) => (
          <p class="text-12-regular text-text-weak mb-2 px-1">
            {language.t("hub.goal.runtimeStatus")}: {runtime().status} · {runtime().continuationCount}/{runtime().budget}
          </p>
        )}
      </Show>
      <HubPanel>
        <div class="p-3 flex flex-col gap-2">
          <TextField
            multiline
            label={language.t("hub.goal.label")}
            placeholder={language.t("hub.goal.placeholder")}
            value={goal()}
            onChange={(value) => {
              setDirty(true)
              setGoal(value)
            }}
          />
          <p class="text-12-regular text-text-weak px-1">
            {language.t("hub.goal.chatHint")}
          </p>
          <Button variant="primary" size="small" onClick={() => void saveGoal()}>
            {language.t("common.save")}
          </Button>
        </div>
      </HubPanel>
    </div>
  )
}
