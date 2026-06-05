import { createSignal, For, Show, type Component } from "solid-js"
import { Button } from "@agence-ai/ui/button"
import { TextField } from "@agence-ai/ui/text-field"
import { Tag } from "@agence-ai/ui/tag"
import { useLanguage } from "@/context/language"
import { fetchHubPersona, saveHubPersona, updateHubManifest } from "@/utils/hub-api"
import type { HubState } from "@/utils/hub-api"
import { HubPanel, HubSectionHint, HubSelectableRow } from "./shared"
import { HubInstallForm } from "./install-form"
import { showHubMutationError } from "./mutation-error"
import { useHubResourceToggle } from "./resource-toggle"
import type { HubHttpOpts } from "./use-project-hub"

export const ProjectHubPersonaSection: Component<{
  state: HubState
  httpOpts: () => HubHttpOpts
  onChanged: () => void
}> = (props) => {
  const language = useLanguage()
  const [editingId, setEditingId] = createSignal<string | undefined>()
  const [name, setName] = createSignal("")
  const [description, setDescription] = createSignal("")
  const [prompt, setPrompt] = createSignal("")
  const [busy, setBusy] = createSignal(false)

  const personas = () => props.state.personas ?? []

  const personasList = () =>
    personas().filter((persona) => persona.mode === "primary" || persona.mode === "all" || !persona.mode)

  const { busy: toggleBusy, toggle: togglePersona } = useHubResourceToggle({
    httpOpts: props.httpOpts,
    onChanged: props.onChanged,
  })

  const resetForm = () => {
    setEditingId(undefined)
    setName("")
    setDescription("")
    setPrompt("")
  }

  const setActive = async (personaID: string) => {
    const opts = props.httpOpts()
    if (!opts.directory || !opts.baseUrl) return
    try {
      await updateHubManifest({ ...opts, manifest: { persona_id: personaID } })
      props.onChanged()
    } catch (error) {
      showHubMutationError(language.t("common.requestFailed"), error)
    }
  }

  const loadForEdit = async (personaID: string) => {
    const opts = props.httpOpts()
    if (!opts.directory || !opts.baseUrl) return
    setBusy(true)
    try {
      const content = await fetchHubPersona({ ...opts, personaID })
      setEditingId(content.id)
      setName(content.name)
      setDescription(content.description ?? "")
      setPrompt(content.prompt)
    } catch (error) {
      showHubMutationError(language.t("common.requestFailed"), error)
    } finally {
      setBusy(false)
    }
  }

  const save = async (activate: boolean) => {
    const opts = props.httpOpts()
    const trimmedName = name().trim()
    const trimmedPrompt = prompt().trim()
    if (!opts.directory || !opts.baseUrl || !trimmedName || !trimmedPrompt || busy()) return
    setBusy(true)
    try {
      await saveHubPersona({
        ...opts,
        id: editingId(),
        name: trimmedName,
        description: description().trim() || undefined,
        prompt: trimmedPrompt,
        activate,
      })
      resetForm()
      props.onChanged()
    } catch (error) {
      showHubMutationError(language.t("common.requestFailed"), error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div class="flex flex-col">
      <HubSectionHint>{language.t("hub.persona.description")}</HubSectionHint>
      <p class="text-11-regular text-text-weaker mb-2">{language.t("hub.resources.selectHint")}</p>

      <HubPanel>
        <For each={personasList()}>
          {(persona) => (
            <HubSelectableRow
              title={persona.name}
              subtitle={persona.custom ? language.t("hub.persona.custom") : persona.description}
              checked={persona.enabled}
              locked={persona.locked}
              busy={toggleBusy() === `persona:${persona.id}`}
              onChange={(checked) => void togglePersona("persona", persona.id, checked)}
              trailing={
                <div class="flex items-center gap-1.5 shrink-0">
                  <Show when={persona.custom}>
                    <button
                      type="button"
                      class="text-11-medium text-text-weak hover:text-text-base px-1"
                      onClick={() => void loadForEdit(persona.id)}
                    >
                      {language.t("common.edit")}
                    </button>
                  </Show>
                  <Show when={persona.active}>
                    <Tag>{language.t("hub.tag.active")}</Tag>
                  </Show>
                  <Show when={!persona.active && persona.enabled}>
                    <button
                      type="button"
                      class="text-11-medium text-text-weak hover:text-text-base px-1"
                      onClick={() => void setActive(persona.id)}
                    >
                      {language.t("hub.persona.use")}
                    </button>
                  </Show>
                  <Show when={persona.locked}>
                    <Tag>{language.t("hub.tag.bundle")}</Tag>
                  </Show>
                </div>
              }
            />
          )}
        </For>
      </HubPanel>

      <div class="mt-4 flex flex-col gap-2">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-13-medium text-text-strong">
            {editingId() ? language.t("hub.persona.edit") : language.t("hub.persona.create")}
          </h3>
          <Show when={editingId() || name() || prompt()}>
            <button type="button" class="text-11-medium text-text-weak hover:text-text-base" onClick={resetForm}>
              {language.t("hub.persona.new")}
            </button>
          </Show>
        </div>

        <HubPanel>
          <div class="p-3 flex flex-col gap-2">
            <TextField label={language.t("hub.persona.name")} value={name()} onChange={setName} />
            <TextField
              label={language.t("hub.persona.summary")}
              value={description()}
              onChange={setDescription}
            />
            <label class="flex flex-col gap-1">
              <span class="text-12-medium text-text-base">{language.t("hub.persona.instructions")}</span>
              <textarea
                class="min-h-32 rounded-md border border-border-weak-base bg-surface-base p-2 text-12-regular text-text-base resize-y"
                placeholder={language.t("hub.persona.instructionsPlaceholder")}
                value={prompt()}
                onInput={(event) => setPrompt(event.currentTarget.value)}
              />
            </label>
            <div class="flex flex-wrap gap-2 pt-1">
              <Button variant="primary" size="small" disabled={busy()} onClick={() => void save(false)}>
                {language.t("common.save")}
              </Button>
              <Button variant="secondary" size="small" disabled={busy()} onClick={() => void save(true)}>
                {language.t("hub.persona.saveAndUse")}
              </Button>
            </div>
          </div>
        </HubPanel>
      </div>

      <HubInstallForm type="persona" httpOpts={props.httpOpts} onDone={props.onChanged} />
    </div>
  )
}
