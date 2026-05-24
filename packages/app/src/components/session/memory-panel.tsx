// Memory Panel: Search and browse archived conversations.
// Left of the context tab in the session side panel.
// Shows recent sessions with archive status and search capability.
import { createSignal, For, Show, createMemo } from "solid-js"
import { Icon } from "@agence-ai/ui/icon"
import { IconButton } from "@agence-ai/ui/icon-button"
import { useGlobalSync } from "@/context/global-sync"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { sessionTitle } from "@/utils/session-title"
import { sortedRootSessions } from "@/pages/layout/helpers"
import { pathKey } from "@/utils/path-key"
import { useNavigate } from "@solidjs/router"

export function MemoryPanel() {
  const language = useLanguage()
  const layout = useLayout()
  const globalSync = useGlobalSync()
  const navigate = useNavigate()
  const [search, setSearch] = createSignal("")

  const projects = createMemo(() => layout.projects.list())
  const projectDirs = createMemo(() => projects().flatMap((p) => [p.worktree, ...(p.sandboxes ?? [])]))

  const sessions = createMemo(() => {
    const dirs = projectDirs()
    return dirs.flatMap((dir) => {
      const [, store] = globalSync.child(dir, { bootstrap: false })
      const list = sortedRootSessions(store, Date.now())
      return list.map((s) => ({ ...s, _dir: dir }))
    }).sort((a, b) => (b.time.updated ?? b.time.created) - (a.time.updated ?? a.time.created))
  })

  const filtered = createMemo(() => {
    const q = search().toLowerCase()
    if (!q) return sessions()
    return sessions().filter((s) => sessionTitle(s.title).toLowerCase().includes(q))
  })

  const dirName = (d: string) => d.split(/[/\\]/).pop() || d

  return (
    <div class="flex flex-col h-full">
      <div class="px-4 py-3">
        <div class="flex items-center gap-2 bg-surface-raised-base rounded-md px-3 py-1.5">
          <Icon name="search" size="small" class="text-icon-weak shrink-0" />
          <input
            type="text"
            placeholder={language.t("common.search") ?? "Search conversations..."}
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
                <Icon name="conversation" size="small" class="text-icon-weak shrink-0" />
                <div class="min-w-0 flex-1">
                  <div class="text-12-regular text-text-strong truncate">{sessionTitle(session.title)}</div>
                  <div class="text-11-regular text-text-weaker truncate">{dirName(session._dir)}</div>
                </div>
                <Show when={session.time?.archived}>
                  <Icon name="archive" size="small" class="text-icon-weak opacity-50 group-hover/mem:opacity-100 shrink-0" />
                </Show>
              </div>
            )
          }}
        </For>
        <Show when={filtered().length === 0}>
          <div class="flex flex-col items-center justify-center py-16 gap-3 text-text-weak">
            <Icon name="archive" size="large" class="opacity-30 size-10" />
            <div class="text-12-regular">{search() ? "No matches found" : "Conversations will appear here when archived"}</div>
          </div>
        </Show>
      </div>
    </div>
  )
}
