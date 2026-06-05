import { Show, type Component, type JSX } from "solid-js"
import { IconButton } from "@agence-ai/ui/icon-button"
import { useLanguage } from "@/context/language"
import type { HubSectionId } from "./types"

export const ProjectHubShell: Component<{
  projectLabel: string
  section: HubSectionId
  onBack?: () => void
  children: JSX.Element
  footer?: JSX.Element
}> = (props) => {
  const language = useLanguage()
  const sectionTitle = () => {
    if (props.section === "home") return language.t("hub.title")
    const key = `hub.nav.${props.section}` as const
    const value = language.t(key)
    return value === key ? props.section : value
  }

  return (
    <div class="flex flex-col min-h-0 h-full">
      <div class="shrink-0 px-5 pt-4 pb-3 border-b border-border-weak-base">
        <div class="flex items-center gap-1.5 max-w-md mx-auto w-full">
          <Show when={props.section !== "home" && props.onBack}>
            <IconButton
              icon="chevron-left"
              variant="ghost"
              size="small"
              class="shrink-0 -ml-1"
              aria-label={language.t("common.goBack")}
              onClick={props.onBack}
            />
          </Show>
          <div class="flex flex-col min-w-0 flex-1">
            <div class="flex items-baseline gap-2 min-w-0">
              <h1 class="text-15-medium text-text-strong truncate">{sectionTitle()}</h1>
              <span class="text-11-regular text-text-weak truncate shrink">{props.projectLabel}</span>
            </div>
            <Show when={props.section === "home"}>
              <p class="text-12-regular text-text-weak truncate">{language.t("hub.subtitle")}</p>
            </Show>
          </div>
        </div>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto settings-scrollbar px-5 py-4">
        <div class="max-w-md mx-auto w-full">{props.children}</div>
      </div>

      <Show when={props.footer}>
        <div class="shrink-0 px-5 py-2.5 border-t border-border-weak-base">{props.footer}</div>
      </Show>
    </div>
  )
}
