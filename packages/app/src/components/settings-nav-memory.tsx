import { Show, type Component } from "solid-js"
import { Tabs } from "@agence-ai/ui/tabs"
import { Icon } from "@agence-ai/ui/icon"
import { Tooltip } from "@agence-ai/ui/tooltip"
import { useLanguage } from "@/context/language"
import { settingsTip } from "./settings-tooltip"
import { SettingsNavTrigger } from "./settings-nav-trigger"

export const MEMORY_SETTINGS_TABS = ["memory-memories", "memory-documents", "memory-knowledge", "memory-skills"] as const
export type MemorySettingsTab = (typeof MEMORY_SETTINGS_TABS)[number]

export function isMemorySettingsTab(tab: string): tab is MemorySettingsTab {
  return (MEMORY_SETTINGS_TABS as readonly string[]).includes(tab)
}

export const SettingsMemoryNav: Component<{
  open: boolean
  currentTab: string
  onToggle: () => void
}> = (props) => {
  const language = useLanguage()
  const memoryActive = () => isMemorySettingsTab(props.currentTab)

  return (
    <div class="flex flex-col gap-0.5 w-full">
      <Tooltip
        value={settingsTip(language, "settings.nav.memory")}
        placement="right"
        openDelay={450}
        contentClass="settings-tooltip-popover"
      >
        <button
          type="button"
          class="settings-nav-parent"
          classList={{ "settings-nav-parent-active": memoryActive() }}
          aria-expanded={props.open}
          onClick={() => props.onToggle()}
        >
          <Icon name="brain" />
          <span class="flex-1 min-w-0 truncate text-left">{language.t("settings.tab.memory")}</span>
          <Icon name={props.open ? "chevron-down" : "chevron-right"} size="small" />
        </button>
      </Tooltip>
      <Show when={props.open}>
        <div class="flex flex-col gap-0.5 settings-nav-children">
          <SettingsNavTrigger value="memory-memories" tooltipKey="settings.nav.memoryMemories" class="settings-nav-sub">
            {language.t("settings.memory.sub.memories")}
          </SettingsNavTrigger>
          <SettingsNavTrigger value="memory-documents" tooltipKey="settings.nav.memoryDocuments" class="settings-nav-sub">
            {language.t("settings.memory.sub.documents")}
          </SettingsNavTrigger>
          <SettingsNavTrigger value="memory-knowledge" tooltipKey="settings.nav.memoryKnowledge" class="settings-nav-sub">
            {language.t("settings.memory.sub.knowledge")}
          </SettingsNavTrigger>
          <SettingsNavTrigger value="memory-skills" tooltipKey="settings.nav.memorySkills" class="settings-nav-sub">
            {language.t("settings.memory.sub.skills")}
          </SettingsNavTrigger>
        </div>
      </Show>
    </div>
  )
}
