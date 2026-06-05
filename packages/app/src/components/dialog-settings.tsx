import { Component, createSignal } from "solid-js"
import { Dialog } from "@agence-ai/ui/dialog"
import { Tabs } from "@agence-ai/ui/tabs"
import { Icon } from "@agence-ai/ui/icon"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { SettingsGeneral } from "./settings-general"
import { SettingsKeybinds } from "./settings-keybinds"
import { SettingsProviders } from "./settings-providers"
import { SettingsModels } from "./settings-models"
import { SettingsMemory, type MemorySettingsSubTab } from "./settings-memory"
import { SettingsHeartbeat } from "./settings-heartbeat"
import { SettingsSkillOpt } from "./settings-skill-opt"
import { SettingsProjectProvider } from "@/context/settings-project"
import { isMemorySettingsTab, SettingsMemoryNav, type MemorySettingsTab } from "./settings-nav-memory"
import { SettingsNavTrigger } from "./settings-nav-trigger"

function resolveInitialTab(input: {
  initialTab?: string
  memorySubTab?: MemorySettingsSubTab
}): string {
  if (input.initialTab === "knowledge") return "memory-knowledge"
  if (input.initialTab === "memory") return `memory-${input.memorySubTab ?? "memories"}`
  return input.initialTab ?? "general"
}

export const DialogSettings: Component<{
  initialTab?: string
  memorySubTab?: MemorySettingsSubTab
  projectDirectory?: string
}> = (props) => {
  const language = useLanguage()
  const platform = usePlatform()
  const initial = resolveInitialTab(props)
  const [tab, setTab] = createSignal(initial)
  const [memoryOpen, setMemoryOpen] = createSignal(isMemorySettingsTab(initial))

  const onTabChange = (value: string) => {
    setTab(value)
    if (isMemorySettingsTab(value)) setMemoryOpen(true)
  }

  const toggleMemoryNav = () => {
    const next = !memoryOpen()
    setMemoryOpen(next)
    if (next && !isMemorySettingsTab(tab())) setTab("memory-memories")
  }

  return (
    <Dialog size="x-large" transition>
      <SettingsProjectProvider directory={props.projectDirectory}>
        <Tabs
          orientation="vertical"
          variant="settings"
          value={tab()}
          onChange={onTabChange}
          class="h-full settings-dialog"
        >
          <Tabs.List>
            <div class="flex flex-col justify-between h-full w-full">
              <div class="flex flex-col gap-3 w-full pt-3">
                <div class="flex flex-col gap-3">
                  <div class="flex flex-col gap-1.5">
                    <Tabs.SectionTitle>{language.t("settings.section.desktop")}</Tabs.SectionTitle>
                    <div class="flex flex-col gap-1.5 w-full">
                      <SettingsNavTrigger value="general" tooltipKey="settings.nav.general">
                        <Icon name="sliders" />
                        {language.t("settings.tab.general")}
                      </SettingsNavTrigger>
                      <SettingsNavTrigger value="shortcuts" tooltipKey="settings.nav.shortcuts">
                        <Icon name="keyboard" />
                        {language.t("settings.tab.shortcuts")}
                      </SettingsNavTrigger>
                    </div>
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <Tabs.SectionTitle>{language.t("settings.section.automation")}</Tabs.SectionTitle>
                    <div class="flex flex-col gap-1.5 w-full">
                      <SettingsNavTrigger value="heartbeat" tooltipKey="settings.nav.heartbeat">
                        <Icon name="status" />
                        {language.t("settings.tab.heartbeat")}
                      </SettingsNavTrigger>
                    </div>
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <Tabs.SectionTitle>{language.t("settings.section.learning")}</Tabs.SectionTitle>
                    <div class="flex flex-col gap-1.5 w-full">
                      <SettingsMemoryNav open={memoryOpen()} currentTab={tab()} onToggle={toggleMemoryNav} />
                    </div>
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <Tabs.SectionTitle>{language.t("settings.section.server")}</Tabs.SectionTitle>
                    <div class="flex flex-col gap-1.5 w-full">
                      <SettingsNavTrigger value="providers" tooltipKey="settings.nav.providers">
                        <Icon name="providers" />
                        {language.t("settings.providers.title")}
                      </SettingsNavTrigger>
                      <SettingsNavTrigger value="models" tooltipKey="settings.nav.models">
                        <Icon name="models" />
                        {language.t("settings.models.title")}
                      </SettingsNavTrigger>
                    </div>
                  </div>
                </div>
              </div>
              <div class="flex flex-col gap-1 pl-1 py-1 text-12-medium text-text-weak">
                <span>{language.t("app.name.desktop")}</span>
                <span class="text-11-regular">v{platform.version}</span>
              </div>
            </div>
          </Tabs.List>
          <Tabs.Content value="general" class="settings-scrollbar min-h-0">
            <SettingsGeneral />
          </Tabs.Content>
          <Tabs.Content value="shortcuts" class="settings-scrollbar min-h-0">
            <SettingsKeybinds />
          </Tabs.Content>
          <Tabs.Content value="memory-memories" class="settings-scrollbar min-h-0">
            <SettingsMemory view="memories" />
          </Tabs.Content>
          <Tabs.Content value="memory-documents" class="settings-scrollbar min-h-0">
            <SettingsMemory view="documents" />
          </Tabs.Content>
          <Tabs.Content value="memory-knowledge" class="settings-scrollbar min-h-0">
            <SettingsMemory view="knowledge" />
          </Tabs.Content>
          <Tabs.Content value="memory-skills" class="settings-scrollbar min-h-0">
            <SettingsSkillOpt />
          </Tabs.Content>
          <Tabs.Content value="heartbeat" class="settings-scrollbar min-h-0">
            <SettingsHeartbeat />
          </Tabs.Content>
          <Tabs.Content value="providers" class="settings-scrollbar min-h-0">
            <SettingsProviders />
          </Tabs.Content>
          <Tabs.Content value="models" class="settings-scrollbar min-h-0">
            <SettingsModels />
          </Tabs.Content>
        </Tabs>
      </SettingsProjectProvider>
    </Dialog>
  )
}

export type { MemorySettingsTab }
