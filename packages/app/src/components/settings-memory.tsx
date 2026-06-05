import { createSignal, createResource, For, Show, onMount, type Component } from "solid-js"
import { Button } from "@agence-ai/ui/button"
import { Select } from "@agence-ai/ui/select"
import { Switch } from "@agence-ai/ui/switch"
import { showToast } from "@agence-ai/ui/toast"
import { useLanguage } from "@/context/language"
import { useLearningHttp } from "@/utils/settings-learning"
import { SettingsLearningShell, SettingsNoProject, SettingsRow, SettingsSectionTitle } from "./settings-learning-shell"
import { SettingsKnowledgePanel } from "./settings-knowledge-panel"
import { settingsTip } from "./settings-tooltip"
import { Tooltip } from "@agence-ai/ui/tooltip"

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
  saveImportedDocuments?: boolean
  defaultImportLayer?: "activity" | "context" | "experience" | "identity" | "preference"
}

type IngestScope = "project" | "global"

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

export type MemorySettingsSubTab = "memories" | "documents" | "knowledge"

const importanceOptions = [
  { id: "low", value: "low", label: "Low (more captures)" },
  { id: "medium", value: "medium", label: "Medium" },
  { id: "high", value: "high", label: "High (fewer captures)" },
]

const importLayerOptions = [
  { id: "experience", value: "experience", label: "Experience (default)" },
  { id: "context", value: "context", label: "Context" },
  { id: "activity", value: "activity", label: "Activity" },
  { id: "preference", value: "preference", label: "Preference" },
  { id: "identity", value: "identity", label: "Identity" },
]

const importScopeOptions = [
  { id: "project", value: "project" as const, labelKey: "settings.memory.importScopeProject" as const },
  { id: "global", value: "global" as const, labelKey: "settings.memory.importScopeGlobal" as const },
]

const ACCEPT_IMPORT =
  ".md,.markdown,.txt,.text,.pdf,.docx,.html,.htm,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"

export const SettingsMemory: Component<{ view: MemorySettingsSubTab }> = (props) => {
  const language = useLanguage()
  const { http, directory } = useLearningHttp()
  const [selected, setSelected] = createSignal<Set<string>>(new Set())
  const [busy, setBusy] = createSignal(false)
  const [importScope, setImportScope] = createSignal<IngestScope>("project")
  let fileInput: HTMLInputElement | undefined

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

  const ingestFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setBusy(true)
    let totalChunks = 0
    try {
      for (const file of files) {
        const bytes = new Uint8Array(await file.arrayBuffer())
        if (bytes.byteLength > 12 * 1024 * 1024) {
          showToast({ title: language.t("settings.memory.importTooLarge", { name: file.name }) })
          continue
        }
        let binary = ""
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
        const contentBase64 = btoa(binary)
        const res = await http<{ chunks: number; filename: string }>({
          method: "POST",
          path: "/memory/ingest",
          body: {
            filename: file.name,
            contentBase64,
            scope: importScope(),
            layer: state()?.settings.defaultImportLayer,
          },
        })
        totalChunks += res.chunks
      }
      await refetch()
      showToast({
        title: language.t("settings.memory.importDone", {
          files: String(files.length),
          chunks: String(totalChunks),
        }),
      })
    } catch (e) {
      showToast({ title: String(e) })
    } finally {
      setBusy(false)
      if (fileInput) fileInput.value = ""
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

  onMount(() => {
    if (props.view !== "knowledge") refetch()
  })

  const formatLayer = (layer: string) => layer.charAt(0).toUpperCase() + layer.slice(1)

  const scopeOptions = () =>
    importScopeOptions.map((o) => ({
      ...o,
      label: language.t(o.labelKey),
    }))

  const tip = (id: string) => settingsTip(language, `settings.memory.tooltip.${id}`)

  const shellTitle = () => {
    if (props.view === "documents") return language.t("settings.memory.sub.documents")
    if (props.view === "knowledge") return language.t("settings.memory.sub.knowledge")
    return language.t("settings.memory.sub.memories")
  }

  const shellDescription = () => {
    if (props.view === "documents") return language.t("settings.memory.importDesc")
    if (props.view === "knowledge") return language.t("settings.knowledge.description")
    return language.t("settings.memory.description")
  }

  return (
    <SettingsLearningShell
      title={shellTitle()}
      description={shellDescription()}
      titleTooltip={settingsTip(
        language,
        props.view === "documents"
          ? "settings.nav.memoryDocuments"
          : props.view === "knowledge"
            ? "settings.nav.memoryKnowledge"
            : "settings.nav.memoryMemories",
      )}
      loading={props.view !== "knowledge" && state.loading && !state()}
      error={props.view !== "knowledge" ? state.error : undefined}
      onRetry={props.view !== "knowledge" ? refetch : undefined}
    >
      <Show when={props.view === "knowledge"}>
        <SettingsKnowledgePanel />
      </Show>

      <Show when={props.view !== "knowledge" && !directory()}>
        <SettingsNoProject message={language.t("settings.learning.noProject")} />
      </Show>

      <Show when={props.view === "documents" && directory() && state() ? (state() as MemoryState) : undefined}>
        {(s) => (
          <div class="flex flex-col gap-6 w-full">
            <div class="bg-surface-base px-4 rounded-lg flex flex-col">
              <SettingsRow
                title={language.t("settings.memory.importScope")}
                desc={language.t("settings.memory.importScopeDesc")}
                tooltip={tip("importScope")}
              >
                <Select
                  options={scopeOptions()}
                  current={scopeOptions().find((o) => o.value === importScope())}
                  value={(o) => o.value}
                  label={(o) => o.label}
                  onSelect={(option) => {
                    if (!option) return
                    setImportScope(option.value)
                  }}
                  variant="secondary"
                  size="small"
                  triggerVariant="settings"
                  disabled={busy()}
                />
              </SettingsRow>
              <SettingsRow
                title={language.t("settings.memory.saveImported")}
                desc={language.t("settings.memory.saveImportedDesc")}
                tooltip={tip("saveImported")}
              >
                <Switch
                  checked={s().settings.saveImportedDocuments !== false}
                  onChange={(v) => saveSettings({ saveImportedDocuments: v })}
                  disabled={busy()}
                />
              </SettingsRow>
              <SettingsRow
                title={language.t("settings.memory.defaultImportLayer")}
                desc={language.t("settings.memory.defaultImportLayerDesc")}
                tooltip={tip("defaultImportLayer")}
              >
                <Select
                  options={importLayerOptions}
                  current={importLayerOptions.find((o) => o.value === (s().settings.defaultImportLayer ?? "experience"))}
                  value={(o) => o.value}
                  label={(o) => o.label}
                  onSelect={(option) => {
                    if (!option) return
                    saveSettings({ defaultImportLayer: option.value as MemorySettings["defaultImportLayer"] })
                  }}
                  variant="secondary"
                  size="small"
                  triggerVariant="settings"
                  disabled={busy()}
                />
              </SettingsRow>
            </div>
            <input
              ref={(el) => {
                fileInput = el
              }}
              type="file"
              class="hidden"
              accept={ACCEPT_IMPORT}
              multiple
              onChange={(e) => ingestFiles(e.currentTarget.files)}
            />
            <div class="flex flex-wrap gap-2">
              <Button size="small" variant="secondary" disabled={busy()} onClick={() => fileInput?.click()}>
                {language.t("settings.memory.importChoose")}
              </Button>
            </div>
            <p class="text-11-regular text-text-weaker">{language.t("settings.memory.importFormats")}</p>
          </div>
        )}
      </Show>

      <Show when={props.view === "memories" && directory() && state() ? (state() as MemoryState) : undefined}>
        {(s) => (
          <div class="flex flex-col gap-8 w-full">
            <section class="flex flex-col gap-1">
              <SettingsSectionTitle title={language.t("settings.memory.captureTitle")} tooltip={tip("captureSection")} />
              <div class="bg-surface-base px-4 rounded-lg flex flex-col">
                <SettingsRow
                  title={language.t("settings.memory.autoCapture")}
                  desc={language.t("settings.memory.autoCaptureDesc")}
                  tooltip={tip("autoCapture")}
                >
                    <Switch
                      checked={s().settings.autoCaptureEnabled !== false}
                      onChange={(v) => saveSettings({ autoCaptureEnabled: v })}
                      disabled={busy()}
                    />
                  </SettingsRow>
                  <SettingsRow
                  title={language.t("settings.memory.sensitivity")}
                  desc={language.t("settings.memory.sensitivityDesc")}
                  tooltip={tip("sensitivity")}
                >
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
                  </SettingsRow>
                  <SettingsRow
                  title={language.t("settings.memory.preferences")}
                  desc={language.t("settings.memory.preferencesDesc")}
                  tooltip={tip("preferences")}
                >
                    <Switch
                      checked={s().settings.capturePreferences !== false}
                      onChange={(v) => saveSettings({ capturePreferences: v })}
                      disabled={busy()}
                    />
                  </SettingsRow>
                  <SettingsRow
                  title={language.t("settings.memory.corrections")}
                  desc={language.t("settings.memory.correctionsDesc")}
                  tooltip={tip("corrections")}
                >
                    <Switch
                      checked={s().settings.captureCorrections !== false}
                      onChange={(v) => saveSettings({ captureCorrections: v })}
                      disabled={busy()}
                    />
                  </SettingsRow>
                  <SettingsRow
                  title={language.t("settings.memory.toolFailures")}
                  desc={language.t("settings.memory.toolFailuresDesc")}
                  tooltip={tip("toolFailures")}
                >
                    <Switch
                      checked={s().settings.captureToolFailures !== false}
                      onChange={(v) => saveSettings({ captureToolFailures: v })}
                      disabled={busy()}
                    />
                  </SettingsRow>
                  <SettingsRow
                  title={language.t("settings.memory.globalRecall")}
                  desc={language.t("settings.memory.globalRecallDesc")}
                  tooltip={tip("globalRecall")}
                >
                    <Switch
                      checked={s().settings.globalRecall !== false}
                      onChange={(v) => saveSettings({ globalRecall: v })}
                      disabled={busy()}
                    />
                  </SettingsRow>
                </div>
              </section>

            <section class="flex flex-col gap-1">
              <SettingsSectionTitle title={language.t("settings.memory.maintenanceTitle")} tooltip={tip("maintenanceSection")} />
              <div class="bg-surface-base px-4 rounded-lg flex flex-col">
                <SettingsRow
                  title={language.t("settings.memory.autoConsolidate")}
                  desc={language.t("settings.memory.autoConsolidateDesc")}
                  tooltip={tip("autoConsolidate")}
                >
                    <Switch
                      checked={s().settings.autoConsolidate !== false}
                      onChange={(v) => saveSettings({ autoConsolidate: v })}
                      disabled={busy()}
                    />
                  </SettingsRow>
                  <SettingsRow
                  title={language.t("settings.memory.autoPrune")}
                  desc={language.t("settings.memory.autoPruneDesc")}
                  tooltip={tip("autoPrune")}
                >
                    <Switch
                      checked={s().settings.autoPruneStale !== false}
                      onChange={(v) => saveSettings({ autoPruneStale: v })}
                      disabled={busy()}
                    />
                  </SettingsRow>
                <SettingsRow
                  title={language.t("settings.memory.autoPruneRedundant")}
                  desc={language.t("settings.memory.autoPruneRedundantDesc")}
                  tooltip={tip("autoPruneRedundant")}
                >
                    <Switch
                      checked={s().settings.autoPruneRedundant !== false}
                      onChange={(v) => saveSettings({ autoPruneRedundant: v })}
                      disabled={busy()}
                    />
                  </SettingsRow>
                <SettingsRow
                  title={language.t("settings.memory.exportOnMaintenance")}
                  desc={language.t("settings.memory.exportOnMaintenanceDesc")}
                  tooltip={tip("exportOnMaintenance")}
                >
                    <Switch
                      checked={s().settings.exportOnMaintenance === true}
                      onChange={(v) => saveSettings({ exportOnMaintenance: v })}
                      disabled={busy()}
                    />
                  </SettingsRow>
                <div class="flex flex-wrap gap-2 py-3 border-t border-border-weak-base">
                  <Tooltip value={tip("exportNow")} placement="top" openDelay={400} contentClass="settings-tooltip-popover">
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
                  </Tooltip>
                  <Tooltip value={tip("runMaintenance")} placement="top" openDelay={400} contentClass="settings-tooltip-popover">
                    <Button size="small" variant="secondary" disabled={busy()} onClick={runMaintenance}>
                      {language.t("settings.memory.runMaintenance")}
                    </Button>
                  </Tooltip>
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
                        <input
                          type="checkbox"
                          checked={selected().has(item.id)}
                          class="mt-1 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleSelect(item.id)
                          }}
                          onChange={() => {}}
                        />
                        <div class="flex flex-col gap-0.5 min-w-0">
                          <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-12-medium text-text-strong truncate">{item.concept}</span>
                            <span class="text-10-regular px-1.5 py-0.5 rounded bg-surface-raised-base text-text-weaker uppercase">
                              {item.layer}
                            </span>
                            <For each={(item.tags ?? []).slice(0, 3)}>
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
                            <span class="text-10-regular text-text-weaker">decay {((item.decay ?? 0) * 100).toFixed(0)}%</span>
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
    </SettingsLearningShell>
  )
}
