import { createMemo } from "solid-js"
import { useSearchParams } from "@solidjs/router"
import { useLayout } from "@/context/layout"
import { ProjectHubContent, parseHubSection } from "@/components/project-hub/content"
import type { HubSectionId } from "@/components/project-hub/types"

export default function ProjectHubPage() {
  const layout = useLayout()
  const [params, setParams] = useSearchParams()

  const directory = createMemo(() => {
    const fromQuery = params.directory
    if (typeof fromQuery === "string" && fromQuery.length > 0) return fromQuery
    if (Array.isArray(fromQuery) && fromQuery[0]) return fromQuery[0]
    const expanded = layout.projects.list().find((project) => project.expanded)
    if (expanded?.worktree) return expanded.worktree
    const first = layout.projects.list()[0]
    return first?.worktree ?? ""
  })

  const section = createMemo(() => parseHubSection(params.section))

  const setSection = (next: HubSectionId) => {
    setParams({
      directory: directory() || undefined,
      section: next === "home" ? undefined : next,
    })
  }

  return (
    <div class="h-full bg-background-base">
      <ProjectHubContent directory={directory} section={section} onSectionChange={setSection} />
    </div>
  )
}
