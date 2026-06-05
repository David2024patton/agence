import { For, type Component } from "solid-js"
import { Icon } from "@agence-ai/ui/icon"
import { useLanguage } from "@/context/language"
import type { HubState } from "@/utils/hub-api"
import type { HubSectionId } from "./types"
import { HubNavRow, HubPanel } from "./shared"

export const ProjectHubHome: Component<{
  state: HubState
  onNavigate: (section: HubSectionId) => void
}> = (props) => {
  const language = useLanguage()
  const personas = () => props.state.personas ?? []
  const skills = () => props.state.skills ?? []
  const mcps = () => props.state.mcps ?? []
  const groups = () => props.state.groups ?? []
  const manifest = () => props.state.manifest ?? {}

  const activePersona = () => personas().find((item) => item.active)
  const enabledSkills = () => skills().filter((item) => item.enabled).length
  const connectedMcps = () => mcps().filter((item) => item.enabled).length
  const enabledBundles = () => groups().filter((item) => item.enabled).length

  const rows = () => [
    {
      id: "persona" as const,
      icon: "agent",
      title: language.t("hub.nav.persona"),
      value: activePersona()?.name ?? language.t("hub.none"),
    },
    {
      id: "skills" as const,
      icon: "file",
      title: language.t("hub.nav.skills"),
      value: String(enabledSkills()),
    },
    {
      id: "mcps" as const,
      icon: "mcp",
      title: language.t("hub.nav.mcps"),
      value: String(connectedMcps()),
    },
    {
      id: "bundles" as const,
      icon: "models",
      title: language.t("hub.nav.bundles"),
      value: String(enabledBundles()),
    },
    {
      id: "goal" as const,
      icon: "info",
      title: language.t("hub.nav.goal"),
      value: manifest().goal
        ? props.state.goal?.status === "active"
          ? language.t("hub.tag.active")
          : props.state.goal?.status ?? language.t("hub.set")
        : language.t("hub.notSet"),
    },
  ]

  return (
    <div class="max-w-md mx-auto w-full">
      <HubPanel>
        <For each={rows()}>
          {(row) => (
            <HubNavRow
              icon={row.icon}
              title={row.title}
              value={row.value}
              onClick={() => props.onNavigate(row.id)}
            />
          )}
        </For>
      </HubPanel>
    </div>
  )
}

export const ProjectHubQuickLinks: Component<{
  directory: string
  onKnowledge: () => void
  onMemory: () => void
  onSessions: () => void
}> = (props) => {
  const language = useLanguage()
  const links = [
    { icon: "archive", label: language.t("hub.link.knowledge"), onClick: props.onKnowledge },
    { icon: "brain", label: language.t("hub.link.memory"), onClick: props.onMemory },
    { icon: "bubble-5", label: language.t("hub.link.sessions"), onClick: props.onSessions },
  ]

  return (
    <div class="flex justify-center gap-1">
      <For each={links}>
        {(link) => (
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-11-medium text-text-weak hover:text-text-base hover:bg-surface-raised-base-hover transition-colors"
            onClick={link.onClick}
          >
            <Icon name={link.icon as any} class="w-3.5 h-3.5" />
            {link.label}
          </button>
        )}
      </For>
    </div>
  )
}
