import { createSignal, For, Show, type Component } from "solid-js"
import { Button } from "@agence-ai/ui/button"
import { Switch } from "@agence-ai/ui/switch"
import { TextField } from "@agence-ai/ui/text-field"
import { Tag } from "@agence-ai/ui/tag"
import { useLanguage } from "@/context/language"
import { saveHubGroups, toggleHubGroup } from "@/utils/hub-api"
import type { HubState } from "@/utils/hub-api"
import { HubListRow, HubPanel, HubSectionHint } from "./shared"
import { showHubMutationError } from "./mutation-error"
import type { HubHttpOpts } from "./use-project-hub"

export const ProjectHubBundlesSection: Component<{
  state: HubState
  httpOpts: () => HubHttpOpts
  onChanged: () => void
}> = (props) => {
  const language = useLanguage()
  const [expanded, setExpanded] = createSignal(false)
  const [groupName, setGroupName] = createSignal("")
  const [groupSkills, setGroupSkills] = createSignal<string[]>([])

  const groups = () => props.state.groups ?? []
  const skills = () => props.state.skills ?? []
  const personas = () => props.state.personas ?? []

  const toggleGroup = async (groupID: string, enabled: boolean) => {
    const opts = props.httpOpts()
    if (!opts.directory || !opts.baseUrl) return
    try {
      await toggleHubGroup({ ...opts, groupID, enabled })
      props.onChanged()
    } catch (error) {
      showHubMutationError(language.t("common.requestFailed"), error)
    }
  }

  const toggleSkillForGroup = (skillID: string) => {
    setGroupSkills((current) =>
      current.includes(skillID) ? current.filter((item) => item !== skillID) : [...current, skillID],
    )
  }

  const createGroup = async () => {
    const name = groupName().trim()
    const opts = props.httpOpts()
    if (!opts.directory || !opts.baseUrl || !name) return
    const custom = groups().filter((group) => !group.builtin)
    let id = name.toLowerCase().replace(/[^a-z0-9-_]+/g, "-")
    if (custom.some((group) => group.id === id) || groups().some((group) => group.id === id)) {
      id = `${id}-${Date.now().toString(36)}`
    }
    const persona = personas().find((item) => item.active)?.id ?? "build"
    try {
      await saveHubGroups({
        ...opts,
        groups: [
          ...custom.map((group) => ({
            id: group.id,
            name: group.name,
            description: group.description,
            items: group.items,
          })),
          {
            id,
            name,
            items: [
              { type: "persona", ref: persona },
              ...groupSkills().map((skill) => ({ type: "skill", ref: skill })),
            ],
          },
        ],
      })
      setGroupName("")
      setGroupSkills([])
      setExpanded(false)
      await toggleHubGroup({ ...opts, groupID: id, enabled: true })
      props.onChanged()
    } catch (error) {
      showHubMutationError(language.t("common.requestFailed"), error)
    }
  }

  return (
    <div class="flex flex-col">
      <HubSectionHint>{language.t("hub.bundles.description")}</HubSectionHint>
      <HubPanel>
        <For each={groups()}>
          {(group) => (
            <div class="flex items-center gap-2 px-3 py-2 min-h-10">
              <div class="flex-1 min-w-0">
                <div class="text-13-medium text-text-strong truncate">{group.name}</div>
                <Show when={group.description}>
                  <div class="text-11-regular text-text-weak truncate">{group.description}</div>
                </Show>
              </div>
              <Switch
                checked={group.enabled ?? false}
                onChange={(checked) => void toggleGroup(group.id, checked)}
                hideLabel
              >
                {group.name}
              </Switch>
            </div>
          )}
        </For>
      </HubPanel>

      <button
        type="button"
        class="mt-3 text-12-medium text-text-weak hover:text-text-base text-left"
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded() ? "−" : "+"} {language.t("hub.bundles.create")}
      </button>

      <Show when={expanded()}>
        <HubPanel class="mt-2">
          <div class="p-3 flex flex-col gap-2">
            <TextField label={language.t("hub.group.name")} value={groupName()} onChange={setGroupName} />
            <For each={skills()}>
              {(skill) => (
                <HubListRow
                  title={skill.name}
                  trailing={
                    <Show when={groupSkills().includes(skill.id)}>
                      <Tag>{language.t("hub.tag.selected")}</Tag>
                    </Show>
                  }
                  onClick={() => toggleSkillForGroup(skill.id)}
                />
              )}
            </For>
            <Button variant="primary" size="small" onClick={() => void createGroup()}>
              {language.t("hub.group.create")}
            </Button>
          </div>
        </HubPanel>
      </Show>
    </div>
  )
}
