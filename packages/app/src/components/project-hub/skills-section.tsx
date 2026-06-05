import { For, Show, type Component } from "solid-js"
import { Tag } from "@agence-ai/ui/tag"
import { useLanguage } from "@/context/language"
import type { HubState } from "@/utils/hub-api"
import { HubInstallForm } from "./install-form"
import { HubPanel, HubSectionHint, HubSelectableRow } from "./shared"
import { useHubResourceToggle } from "./resource-toggle"
import type { HubHttpOpts } from "./use-project-hub"

export const ProjectHubSkillsSection: Component<{
  state: HubState
  httpOpts: () => HubHttpOpts
  onChanged: () => void
}> = (props) => {
  const language = useLanguage()
  const skills = () => props.state.skills ?? []
  const { busy, toggle } = useHubResourceToggle({ httpOpts: props.httpOpts, onChanged: props.onChanged })

  return (
    <div class="flex flex-col">
      <HubSectionHint>{language.t("hub.skills.description")}</HubSectionHint>
      <p class="text-11-regular text-text-weaker mb-2">{language.t("hub.resources.selectHint")}</p>
      <Show
        when={skills().length > 0}
        fallback={<p class="text-12-regular text-text-weak py-2">{language.t("hub.skills.empty")}</p>}
      >
        <HubPanel>
          <For each={skills()}>
            {(skill) => (
              <HubSelectableRow
                title={skill.name}
                subtitle={skill.description}
                checked={skill.enabled}
                locked={skill.locked}
                busy={busy() === `skill:${skill.id}`}
                onChange={(checked) => void toggle("skill", skill.id, checked)}
                trailing={
                  <Show when={skill.locked}>
                    <Tag>{language.t("hub.tag.bundle")}</Tag>
                  </Show>
                }
              />
            )}
          </For>
        </HubPanel>
      </Show>
      <HubInstallForm type="skill" httpOpts={props.httpOpts} onDone={props.onChanged} />
    </div>
  )
}
