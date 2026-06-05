// Memory Panel: archived conversations and stored agent learnings.
import { createSignal, For, Show, createMemo, createResource, onMount } from "solid-js"
import { useParams } from "@solidjs/router"
import { Icon } from "@agence-ai/ui/icon"
import { IconButton } from "@agence-ai/ui/icon-button"
import { useDialog } from "@agence-ai/ui/context/dialog"
import { useGlobalSync } from "@/context/global-sync"
import { useGlobalSDK } from "@/context/global-sdk"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { decode64 } from "@/utils/base64"
import { instanceHttpRequest } from "@/utils/instance-http"
import { sessionTitle } from "@/utils/session-title"
import { sortedRootSessions } from "@/pages/layout/helpers"
import { pathKey } from "@/utils/path-key"
import { useNavigate } from "@solidjs/router"
import { DialogSettings } from "@/components/dialog-settings"

type MemoryItem = {
  id: string
  concept: string
  description: string
  layer: string
  tags: string[]
  scope: "project" | "global"
  decay: number
}

type PanelTab = "conversations" | "knowledge"

export function MemoryPanel() {
  const language = useLanguage()
  const layout = useLayout()
  const globalSync = useGlobalSync()
  const gsdk = useGlobalSDK()
  const server = useServer()
  const platform = usePlatform()
  const params = useParams()
  const dialog = useDialog()
  const navigate = useNavigate()
  const projects = createMemo(() => layout.projects.list())
  const directory = createMemo(() => decode64(params.dir) ?? "")
  const [search, setSearch] = createSignal("")
  const [tab, setTab] = createSignal<PanelTab>("conversations")
  const projectDirs = createMemo(() => projects().flatMap((p) => [p.worktree, ...(p.sandboxes ?? [])]))

  const sessions = createMemo(() => {
    const dirs = projectDirs()
    return dirs
      .flatMap((dir) => {
        const [store] = globalSync.child(dir, { bootstrap: false })
        const list = sortedRootSessions(store, Date.now())
        return list.map((s) => ({ ...s, _dir: dir }))
      })
      .sort((a, b) => (b.time.updated ?? b.time.created) - (a.time.updated ?? a.time.created))
  })

  const filtered = createMemo(() => {
    const q = search().toLowerCase()
    if (!q) return sessions()
    return sessions().filter((s: any) => (sessionTitle(s?.title ?? "") ?? "").toLowerCase().includes(q))
  })

  const [knowledge, { refetch: refetchKnowledge }] = createResource(
    () => (tab() === "knowledge" ? directory() : undefined),
    async (dir) => {
      if (!dir) return [] as MemoryItem[]
      return instanceHttpRequest<MemoryItem[]>({
        baseUrl: gsdk.url,
        server: server.current,
        directory: dir,
        fetch: platform.fetch,
        method: "GET",
        path: "/memory/list?limit=50",
      })
    },
  )

  const filteredKnowledge = createMemo(() => {
    const q = search().toLowerCase()
    const list = knowledge() ?? []
    if (!q) return list
    return list.filter(
      (m) =>
        m.concept.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.layer.toLowerCase().includes(q),
    )
  })

  onMount(() => {
    if (tab() === "knowledge") refetchKnowledge()
  })

  const dirName = (d: string) => d.split(/[/\\]/).pop() || d

  const openMemorySettings = () =>
    dialog.show(() => (
      <DialogSettings
        initialTab={tab() === "knowledge" ? "knowledge" : "memory"}
        memorySubTab={tab() === "knowledge" ? "knowledge" : "memories"}
        projectDirectory={directory()}
      />
    ))

  return (
    <div class="flex flex-col h-full">
      <div class="px-4 pt-3 pb-2 flex items-center gap-1">
        <button
          type="button"
          class="text-11-medium px-2 py-1 rounded-md"
          classList={{
            "bg-surface-raised-base text-text-strong": tab() === "conversations",
            "text-text-weaker hover:text-text-weak": tab() !== "conversations",
          }}
          onClick={() => setTab("conversations")}
        >
          {language.t("memory.panel.tab.conversations")}
        </button>
        <button
          type="button"
          class="text-11-medium px-2 py-1 rounded-md"
          classList={{
            "bg-surface-raised-base text-text-strong": tab() === "knowledge",
            "text-text-weaker hover:text-text-weak": tab() !== "knowledge",
          }}
          onClick={() => {
            setTab("knowledge")
            refetchKnowledge()
          }}
        >
          {language.t("memory.panel.tab.knowledge")}
        </button>
        <div class="flex-1" />
        <Show when={tab() === "knowledge"}>
          <IconButton
            icon="sliders"
            variant="ghost"
            size="small"
            title={language.t("memory.panel.openSettings")}
            onClick={openMemorySettings}
          />
        </Show>
      </div>

      <div class="px-4 pb-3">
        <div class="flex items-center gap-2 bg-surface-raised-base rounded-md px-3 py-1.5">
          <Icon name="magnifying-glass" size="small" class="text-icon-weak shrink-0" />
          <input
            type="text"
            placeholder={language.t("common.search") ?? "Search..."}
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
            class="flex-1 bg-transparent text-12-regular text-text-strong placeholder:text-text-weaker outline-none"
          />
          <Show when={search()}>
            <IconButton
              icon="close-small"
              variant="ghost"
              size="small"
              class="size-5"
              onClick={() => setSearch("")}
            />
          </Show>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto px-4 pb-4">
        <Show when={tab() === "conversations"}>
          <div class="text-11-regular text-text-weaker pb-2">
            {filtered().length} conversation{filtered().length !== 1 ? "s" : ""}
          </div>
          <For each={filtered().slice(0, 100)}>
            {(session) => {
              const slug = () => {
                for (const p of projects()) {
                  if (p.worktree === session._dir || p.sandboxes?.includes(session._dir)) return pathKey(p.worktree)
                }
                return pathKey(session._dir)
              }
              return (
                <div
                  class="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-surface-raised-base-hover cursor-pointer group/mem"
                  onClick={() => navigate(`/${slug()}/session/${session.id}`)}
                >
                  <Icon name="bubble-5" size="small" class="text-icon-weak shrink-0" />
                  <div class="min-w-0 flex-1">
                    <div class="text-12-regular text-text-strong truncate">{sessionTitle(session.title) ?? ""}</div>
                    <div class="text-11-regular text-text-weaker truncate">{dirName(session._dir)}</div>
                  </div>
                  <Show when={session.time?.archived}>
                    <Icon
                      name="archive"
                      size="small"
                      class="text-icon-weak opacity-50 group-hover/mem:opacity-100 shrink-0"
                    />
                  </Show>
                </div>
              )
            }}
          </For>
          <Show when={filtered().length === 0}>
            <div class="flex flex-col items-center justify-center py-16 gap-3 text-text-weak">
              <Icon name="archive" size="large" class="opacity-30 size-10" />
              <div class="text-12-regular">
                {search() ? "No matches found" : "Conversations will appear here when archived"}
              </div>
            </div>
          </Show>
        </Show>

        <Show when={tab() === "knowledge"}>
          <div class="text-11-regular text-text-weaker pb-2">
            {filteredKnowledge().length} memor{filteredKnowledge().length === 1 ? "y" : "ies"}
          </div>
          <For each={filteredKnowledge()}>
            {(item) => (
              <div class="py-2 px-2 rounded-md border border-border-weaker-base mb-1.5">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-12-medium text-text-strong truncate">{item.concept}</span>
                  <span class="text-10-regular px-1.5 py-0.5 rounded bg-surface-raised-base text-text-weaker uppercase">
                    {item.layer}
                  </span>
                  <For each={item.tags?.slice(0, 2) ?? []}>
                    {(tag) => <span class="text-10-regular text-text-interactive-base">#{tag}</span>}
                  </For>
                  <Show when={item.scope === "global"}>
                    <span class="text-10-regular text-text-interactive-base">global</span>
                  </Show>
                </div>
                <p class="text-11-regular text-text-weak line-clamp-2 mt-0.5">{item.description}</p>
              </div>
            )}
          </For>
          <Show when={knowledge.loading}>
            <p class="text-12-regular text-text-weaker py-8 text-center">{language.t("common.loading")}</p>
          </Show>
          <Show when={!knowledge.loading && filteredKnowledge().length === 0}>
            <div class="flex flex-col items-center justify-center py-12 gap-2 text-text-weak">
              <Icon name="brain" size="large" class="opacity-30 size-10" />
              <p class="text-12-regular text-center">{language.t("settings.memory.empty")}</p>
              <button type="button" class="text-12-medium text-text-interactive-base" onClick={openMemorySettings}>
                {language.t("memory.panel.openSettings")}
              </button>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  )
}
