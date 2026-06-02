import { Button } from "@agence-ai/ui/button"
import { Match, Show, Switch, type Accessor, type Component } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { base64Encode } from "@agence-ai/core/util/encode"
import { useLanguage } from "@/context/language"
import { ProjectHubBundlesSection } from "./bundles-section"
import { ProjectHubGoalSection } from "./goal-section"
import { ProjectHubHome, ProjectHubQuickLinks } from "./home"
import { ProjectHubMcpsSection } from "./mcps-section"
import { ProjectHubPersonaSection } from "./persona-section"
import { ProjectHubShell } from "./shell"
import { ProjectHubSkillsSection } from "./skills-section"
import type { HubSectionId } from "./types"
import { useProjectHub } from "./use-project-hub"

export const ProjectHubContent: Component<{
  directory: Accessor<string>
  section: Accessor<HubSectionId>
  onSectionChange: (section: HubSectionId) => void
}> = (props) => {
  const language = useLanguage()
  const navigate = useNavigate()
  const { projectLabel, hub, refetch, httpOpts } = useProjectHub(props.directory)

  const goHome = () => props.onSectionChange("home")

  const openKnowledge = () => {
    const dir = props.directory()
    if (!dir) return
    navigate(`/library?directory=${encodeURIComponent(dir)}`)
  }

  const openSessions = () => {
    const dir = props.directory()
    if (!dir) return
    navigate(`/${base64Encode(dir)}/session`)
  }

  const openMemory = () => {
    window.dispatchEvent(new CustomEvent("agence:open-memory-settings"))
  }

  return (
    <ProjectHubShell
      projectLabel={projectLabel()}
      section={props.section()}
      onBack={props.section() === "home" ? undefined : goHome}
      footer={
        props.section() === "home" ? (
          <ProjectHubQuickLinks
            directory={props.directory()}
            onKnowledge={openKnowledge}
            onMemory={openMemory}
            onSessions={openSessions}
          />
        ) : undefined
      }
    >
      <Show when={hub.error}>
        <div class="flex flex-col gap-2 mb-4">
          <div class="text-14-regular text-text-critical">{String(hub.error)}</div>
          <Button variant="secondary" size="small" onClick={() => void refetch()}>
            {language.t("common.retry")}
          </Button>
        </div>
      </Show>

      <Show when={hub.loading && !hub.error && !hub()}>
        <p class="text-13-regular text-text-weak py-8 text-center">{language.t("common.loading")}</p>
      </Show>

      <Show when={!props.directory() && !hub.loading}>
        <p class="text-13-regular text-text-weak py-8 text-center">{language.t("directory.error.projectRequired")}</p>
      </Show>

      <Show when={!hub.loading ? hub() : undefined} keyed>
        {(state) => (
          <Switch>
            <Match when={props.section() === "home"}>
              <ProjectHubHome state={state} onNavigate={props.onSectionChange} />
            </Match>
            <Match when={props.section() === "persona"}>
              <ProjectHubPersonaSection state={state} httpOpts={httpOpts} onChanged={() => void refetch()} />
            </Match>
            <Match when={props.section() === "skills"}>
              <ProjectHubSkillsSection state={state} httpOpts={httpOpts} onChanged={() => void refetch()} />
            </Match>
            <Match when={props.section() === "mcps"}>
              <ProjectHubMcpsSection
                state={state}
                directory={props.directory()}
                httpOpts={httpOpts}
                onChanged={() => void refetch()}
              />
            </Match>
            <Match when={props.section() === "bundles"}>
              <ProjectHubBundlesSection state={state} httpOpts={httpOpts} onChanged={() => void refetch()} />
            </Match>
            <Match when={props.section() === "goal"}>
              <ProjectHubGoalSection state={state} httpOpts={httpOpts} onChanged={() => void refetch()} />
            </Match>
          </Switch>
        )}
      </Show>
    </ProjectHubShell>
  )
}

export function parseHubSection(value: string | string[] | undefined): HubSectionId {
  const raw = typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined
  if (raw === "persona" || raw === "skills" || raw === "mcps" || raw === "bundles" || raw === "goal") return raw
  return "home"
}
