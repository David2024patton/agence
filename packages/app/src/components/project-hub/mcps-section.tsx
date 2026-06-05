import { For, Show, type Component } from "solid-js"
import { Tag } from "@agence-ai/ui/tag"
import { useLanguage } from "@/context/language"
import type { HubState } from "@/utils/hub-api"
import { HubInstallForm } from "./install-form"
import { HubPanel, HubSectionHint, HubSelectableRow } from "./shared"
import { useHubResourceToggle } from "./resource-toggle"
import type { HubHttpOpts } from "./use-project-hub"

export const ProjectHubMcpsSection: Component<{
  state: HubState
  directory: string
  httpOpts: () => HubHttpOpts
  onChanged: () => void
}> = (props) => {
  const language = useLanguage()
  const mcps = () => props.state.mcps ?? []
  const mcpServe = () => props.state.mcpServe ?? { stdio: "agence mcp serve --directory <path>", note: "" }
  const { busy, toggle } = useHubResourceToggle({ httpOpts: props.httpOpts, onChanged: props.onChanged })

  return (
    <div class="flex flex-col">
      <HubSectionHint>{language.t("hub.mcps.description")}</HubSectionHint>
      <p class="text-11-regular text-text-weaker mb-2">{language.t("hub.resources.selectHint")}</p>
      <Show
        when={mcps().length > 0}
        fallback={<p class="text-12-regular text-text-weak py-2">{language.t("hub.mcps.empty")}</p>}
      >
        <HubPanel>
          <For each={mcps()}>
            {(mcp) => (
              <HubSelectableRow
                title={mcp.name}
                subtitle={mcp.status}
                checked={mcp.enabled}
                busy={busy() === `mcp:${mcp.id}`}
                onChange={(checked) => void toggle("mcp", mcp.id, checked)}
                trailing={<Tag>{mcp.type}</Tag>}
              />
            )}
          </For>
        </HubPanel>
      </Show>
      <HubInstallForm type="mcp" httpOpts={props.httpOpts} onDone={props.onChanged} />
      <details class="mt-3 text-11-regular text-text-weak">
        <summary class="cursor-pointer hover:text-text-base">{language.t("hub.mcps.advanced")}</summary>
        <code class="block mt-2 p-2 rounded bg-surface-base text-10-regular break-all">
          {mcpServe().stdio.replace("<path>", props.directory)}
        </code>
      </details>
    </div>
  )
}
