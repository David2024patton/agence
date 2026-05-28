import { createSignal, createResource, For, Show, onMount, createMemo } from "solid-js"
import { useParams } from "@solidjs/router"
import { Button } from "@agence-ai/ui/button"
import { Select } from "@agence-ai/ui/select"
import { Switch } from "@agence-ai/ui/switch"
import { showToast } from "@agence-ai/ui/toast"
import { useGlobalSDK } from "@/context/global-sdk"
import { useLayout } from "@/context/layout"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { decode64 } from "@/utils/base64"
import { instanceHttpRequest } from "@/utils/instance-http"

type MemorySettings = {
  autoCaptureEnabled?: boolean
  capturePreferences?: boolean
  captureCorrections?: boolean
  captureToolFailures?: boolean
  autoConsolidate?: boolean
  autoPruneStale?: boolean
  autoPruneRedundant?: boolean
  exportOnMaintenance?: boolean
  globalRecall?: boolean
  minAutoImportance?: "low" | "medium" | "high"
}

type MemoryItem = {
  id: string
  projectId: string
  source: string
  layer: string
  concept: string
  description: string
  importance?: string
  tags: string[]
  decay: number
  timeCreated: number
  scope: "project" | "global"
}

type MemoryState = {
  settings: MemorySettings
  stats: { total: number; byLayer: Record<string, number>; byTag: Record<string, number>; globalCount: number }
  recent: MemoryItem[]
}

const importanceOptions = [
  { id: "low", value: "low", label: "Low (more captures)" },
  { id: "medium", value: "medium", label: "Medium" },
  { id: "high", value: "high", label: "High (fewer captures)" },
]

export function SettingsMemory() {
  const language = useLanguage()
  const gsdk = useGlobalSDK()
  const layout = useLayout()
  const server = useServer()
  const platform = usePlatform()
  const params = useParams()
  const directory = createMemo(() => {
    const fromRoute = decode64(params.dir)
    if (fromRoute) return fromRoute
    return layout.projects.list()[0]?.worktree
  })
  const [selected, setSelected] = createSignal<Set<string>>(new Set())
  const [busy, setBusy] = createSignal(false)

  const http = <T,>(input: { method: "GET" | "POST"; path: string; body?: unknown }) =>
    instanceHttpRequest<T>({
      baseUrl: gsdk.url,
      server: server.current,
      directory: directory(),
      fetch: platform.fetch,
      ...input,
    })

  const [state, { refetch }] = createResource(async (): Promise<MemoryState | null> => {
    return (await http<MemoryState>({ method: "GET", path: "/memory/state" })) ?? null
  })

  const saveSettings = async (patch: MemorySettings) => {
    const current = state()?.settings ?? {}
    setBusy(true)
    try {
      await http({ method: "POST", path: "/memory/settings", body: { ...current, ...patch } })
      await refetch()
      showToast({ title: language.t("settings.memory.saved") })
    } catch (e) {
      showToast({ title: String(e) })
    } finally {
      setBusy(false)
    }
  }

  const runMaintenance = async () => {
    setBusy(true)
    try {
      const res = await http<{ merged: number; redundant: number; pruned: number }>({
        method: "POST",
        path: "/memory/maintenance",
      })
      await refetch()
      showToast({
        title: language.t("settings.memory.maintenanceDone", {
          merged: String(res.merged),
          redundant: String(res.redundant),
          pruned: String(res.pruned),
        }),
      })
    } catch (e) {
      showToast({ title: String(e) })
    } finally {
      setBusy(false)
    }
  }

  const deleteSelected = async () => {
    const ids = [...selected()]
    if (ids.length === 0) return
    setBusy(true)
    try {
      await http({ method: "POST", path: "/memory/delete", body: { ids } })
      setSelected(new Set<string>())
      await refetch()
      showToast({ title: language.t("settings.memory.deleted", { count: String(ids.length) }) })
    } catch (e) {
      showToast({ title: String(e) })
    } finally {
      setBusy(false)
    }
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selected())
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  onMount(() => refetch())

  const formatLayer = (layer: string) => layer.charAt(0).toUpperCase() + layer.slice(1)

  return (
    <div class="flex flex-col h-full overflow-y-auto no-scrollbar px-4 pb-10 sm:px-10 sm:pb-10">
      <div class="sticky top-0 z-10 bg-[linear-gradient(to_bottom,var(--surface-stronger-non-alpha)_calc(100%_-_24px),transparent)]">
        <div class="flex flex-col gap-1 pt-6 pb-8">
          <h2 class="text-16-medium text-text-strong">{language.t("settings.tab.memory")}</h2>
          <p class="text-12-regular text-text-weak">{language.t("settings.memory.description")}</p>
        </div>
      </div>

      <Show when={!directory()}>
        <p class="text-12-regular text-text-weak py-4">
          Open a project session first so memory settings apply to the active workspace.
        </p>
      </Show>

      <Show when={state.error}>
        <p class="text-12-regular text-text-critical">{String(state.error)}</p>
      </Show>

      <Show when={directory() && state() ? (state() as MemoryState) : undefined}>
        {(s) => (
          <div class="flex flex-col gap-8 w-full">
            <section class="flex flex-col gap-1">
              <h3 class="text-14-medium text-text-strong pb-2">{language.t("settings.memory.captureTitle")}</h3>
              <div class="bg-surface-base px-4 rounded-lg flex flex-col">
                <Row title={language.t("settings.memory.autoCapture")} desc={language.t("settings.memory.autoCaptureDesc")}>
                  <Switch
                    checked={s().settings.autoCaptureEnabled !== false}
                    onChange={(v) => saveSettings({ autoCaptureEnabled: v })}
                    disabled={busy()}
                  />
                </Row>
                <Row title={language.t("settings.memory.sensitivity")} desc={language.t("settings.memory.sensitivityDesc")}>
                  <Select
                    options={importanceOptions}
                    current={importanceOptions.find((o) => o.value === (s().settings.minAutoImportance ?? "low"))}
                    value={(o) => o.value}
                    label={(o) => o.label}
                    onSelect={(option) => {
                      if (!option) return
                      saveSettings({ minAutoImportance: option.value as MemorySettings["minAutoImportance"] })
                    }}
                    variant="secondary"
                    size="small"
                    triggerVariant="settings"
                  />
                </Row>
                <Row title={language.t("settings.memory.preferences")} desc={language.t("settings.memory.preferencesDesc")}>
                  <Switch
                    checked={s().settings.capturePreferences !== false}
                    onChange={(v) => saveSettings({ capturePreferences: v })}
                    disabled={busy()}
                  />
                </Row>
                <Row title={language.t("settings.memory.corrections")} desc={language.t("settings.memory.correctionsDesc")}>
                  <Switch
                    checked={s().settings.captureCorrections !== false}
                    onChange={(v) => saveSettings({ captureCorrections: v })}
                    disabled={busy()}
                  />
                </Row>
                <Row title={language.t("settings.memory.toolFailures")} desc={language.t("settings.memory.toolFailuresDesc")}>
                  <Switch
                    checked={s().settings.captureToolFailures !== false}
                    onChange={(v) => saveSettings({ captureToolFailures: v })}
                    disabled={busy()}
                  />
                </Row>
                <Row title={language.t("settings.memory.globalRecall")} desc={language.t("settings.memory.globalRecallDesc")}>
                  <Switch
                    checked={s().settings.globalRecall !== false}
                    onChange={(v) => saveSettings({ globalRecall: v })}
                    disabled={busy()}
                  />
                </Row>
              </div>
            </section>

            <section class="flex flex-col gap-1">
              <h3 class="text-14-medium text-text-strong pb-2">{language.t("settings.memory.maintenanceTitle")}</h3>
              <div class="bg-surface-base px-4 rounded-lg flex flex-col">
                <Row title={language.t("settings.memory.autoConsolidate")} desc={language.t("settings.memory.autoConsolidateDesc")}>
                  <Switch
                    checked={s().settings.autoConsolidate !== false}
                    onChange={(v) => saveSettings({ autoConsolidate: v })}
                    disabled={busy()}
                  />
                </Row>
                <Row title={language.t("settings.memory.autoPrune")} desc={language.t("settings.memory.autoPruneDesc")}>
                  <Switch
                    checked={s().settings.autoPruneStale !== false}
                    onChange={(v) => saveSettings({ autoPruneStale: v })}
                    disabled={busy()}
                  />
                </Row>
                <Row
                  title={language.t("settings.memory.autoPruneRedundant")}
                  desc={language.t("settings.memory.autoPruneRedundantDesc")}
                >
                  <Switch
                    checked={s().settings.autoPruneRedundant !== false}
                    onChange={(v) => saveSettings({ autoPruneRedundant: v })}
                    disabled={busy()}
                  />
                </Row>
                <Row
                  title={language.t("settings.memory.exportOnMaintenance")}
                  desc={language.t("settings.memory.exportOnMaintenanceDesc")}
                >
                  <Switch
                    checked={s().settings.exportOnMaintenance === true}
                    onChange={(v) => saveSettings({ exportOnMaintenance: v })}
                    disabled={busy()}
                  />
                </Row>
                <div class="flex flex-wrap gap-2 py-3 border-t border-border-weak-base">
                  <Button
                    size="small"
                    variant="secondary"
                    disabled={busy()}
                    onClick={() =>
                      http<{ count: number }>({ method: "POST", path: "/memory/export" }).then((r) =>
                        showToast({ title: `Exported ${r.count} memories` }),
                      )
                    }
                  >
                    {language.t("settings.memory.exportNow")}
                  </Button>
                  <Button size="small" variant="secondary" disabled={busy()} onClick={runMaintenance}>
                    {language.t("settings.memory.runMaintenance")}
                  </Button>
                  <Button
                    size="small"
                    variant="secondary"
                    disabled={busy() || selected().size === 0}
                    onClick={deleteSelected}
                  >
                    {language.t("settings.memory.deleteSelected", { count: String(selected().size) })}
                  </Button>
                </div>
              </div>
            </section>

            <section class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <h3 class="text-14-medium text-text-strong">{language.t("settings.memory.storedTitle")}</h3>
                <span class="text-11-regular text-text-weak">
                  {language.t("settings.memory.stats", {
                    total: String(s().stats.total),
                    global: String(s().stats.globalCount),
                  })}
                </span>
              </div>
              <div class="flex flex-wrap gap-2 pb-1">
                <For each={Object.entries(s().stats.byLayer)}>
                  {([layer, count]) => (
                    <span class="text-11-regular px-2 py-0.5 rounded-full bg-surface-raised-base text-text-weak">
                      {formatLayer(layer)}: {count}
                    </span>
                  )}
                </For>
                <For each={Object.entries(s().stats.byTag ?? {}).slice(0, 12)}>
                  {([tag, count]) => (
                    <span class="text-11-regular px-2 py-0.5 rounded-full bg-surface-interactive-weak text-text-interactive-base">
                      #{tag}: {count}
                    </span>
                  )}
                </For>
              </div>
              <div class="flex flex-col gap-1">
                <For each={s().recent}>
                  {(item) => (
                    <div
                      class="flex gap-2 p-2 rounded-md border border-border-weaker-base hover:bg-surface-raised-base-hover cursor-pointer"
                      onClick={() => toggleSelect(item.id)}
                    >
                      <input type="checkbox" checked={selected().has(item.id)} class="mt-1 shrink-0" readOnly />
                      <div class="flex flex-col gap-0.5 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="text-12-medium text-text-strong truncate">{item.concept}</span>
                          <span class="text-10-regular px-1.5 py-0.5 rounded bg-surface-raised-base text-text-weaker uppercase">
                            {item.layer}
                          </span>
                          <For each={item.tags.slice(0, 3)}>
                            {(tag) => (
                              <span class="text-10-regular px-1.5 py-0.5 rounded bg-surface-interactive-weak text-text-interactive-base">
                                #{tag}
                              </span>
                            )}
                          </For>
                          <Show when={item.scope === "global"}>
                            <span class="text-10-regular px-1.5 py-0.5 rounded bg-surface-interactive-weak text-text-interactive-base">
                              global
                            </span>
                          </Show>
                          <span class="text-10-regular text-text-weaker">decay {(item.decay * 100).toFixed(0)}%</span>
                        </div>
                        <p class="text-11-regular text-text-weak line-clamp-2">{item.description}</p>
                      </div>
                    </div>
                  )}
                </For>
                <Show when={s().recent.length === 0}>
                  <p class="text-12-regular text-text-weaker py-4 text-center">{language.t("settings.memory.empty")}</p>
                </Show>
              </div>
            </section>
          </div>
        )}
      </Show>

      <Show when={state.loading && !state()}>
        <p class="text-12-regular text-text-weaker py-8 text-center">{language.t("common.loading")}</p>
      </Show>
    </div>
  )
}

function Row(props: { title: string; desc: string; children: import("solid-js").JSX.Element }) {
  return (
    <div class="flex flex-wrap items-center gap-4 py-3 border-b border-border-weak-base last:border-none sm:flex-nowrap">
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="text-14-medium text-text-strong">{props.title}</span>
        <span class="text-12-regular text-text-weak">{props.desc}</span>
      </div>
      <div class="flex w-full justify-end sm:w-auto sm:shrink-0">{props.children}</div>
    </div>
  )
}
