import { createEffect, createSignal, type Component } from "solid-js"
import { Dialog } from "@agence-ai/ui/dialog"
import { ProjectHubContent } from "./project-hub/content"
import type { HubSectionId } from "./project-hub/types"

export const DialogProjectHub: Component<{ directory: string }> = (props) => {
  const [section, setSection] = createSignal<HubSectionId>("home")

  createEffect(() => {
    props.directory
    setSection("home")
  })

  return (
    <Dialog size="normal" transition>
      <div class="h-[min(70vh,560px)] flex flex-col min-h-0">
        <ProjectHubContent
          directory={() => props.directory}
          section={section}
          onSectionChange={setSection}
        />
      </div>
    </Dialog>
  )
}
