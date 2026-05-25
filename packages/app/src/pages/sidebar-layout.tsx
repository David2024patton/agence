// Wraps children with the persistent project sidebar.
// Use as a route wrapper so the sidebar stays visible in sessions.
import { createMemo, type ParentProps, Show } from "solid-js"
import { useLayout } from "@/context/layout"
import { useCommand } from "@/context/command"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useNavigate } from "@solidjs/router"
import { SidebarContent } from "./layout/sidebar-shell"
import { ProjectIcon, SessionItem, NewSessionItem } from "./layout/sidebar-items"

export default function SidebarLayout(props: ParentProps) {
  const layout = useLayout()
  const command = useCommand()
  const language = useLanguage()
  const platform = usePlatform()
  const navigate = useNavigate()

  return (
    <div class="flex h-full w-full">
      <Show when={layout.sidebar.opened()}>
        <div class="shrink-0 border-r border-border-weaker-base bg-background-base flex flex-col" style="width: 260px">
          <div class="flex-1 overflow-y-auto p-2">
            <Show when={layout.projects.list().length > 0} fallback={
              <div class="flex items-center justify-center h-full text-12-regular text-text-weak">
                {language.t("sidebar.projects.empty")}
              </div>
            }>
              {/* Just show a minimal project list for now */}
            </Show>
          </div>
        </div>
      </Show>
      <div class="flex-1 min-w-0">{props.children}</div>
    </div>
  )
}
