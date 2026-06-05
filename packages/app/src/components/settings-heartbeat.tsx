import { createSignal, createResource, For, Show, createMemo } from "solid-js"
import { Button } from "@agence-ai/ui/button"
import { Select } from "@agence-ai/ui/select"
import { Switch } from "@agence-ai/ui/switch"
import { TextField } from "@agence-ai/ui/text-field"
import { showToast } from "@agence-ai/ui/toast"
import { useLanguage } from "@/context/language"
import { useLearningHttp } from "@/utils/settings-learning"
import {
  fetchHeartbeatSettingsState,
  initHeartbeatSettingsState,
  saveHeartbeatSettingsState,
  type HeartbeatSettingsState,
} from "@/utils/learning-settings-api"
import { SettingsLearningShell, SettingsNoProject, SettingsSectionTitle } from "./settings-learning-shell"
import { settingsTip, SettingsHelpTrigger } from "./settings-tooltip"

type HeartbeatTask = HeartbeatSettingsState["tasks"][number]

const intervalPresets = [
  { id: "15m", value: "15m", label: "Every 15 minutes" },
  { id: "30m", value: "30m", label: "Every 30 minutes" },
  { id: "1h", value: "1h", label: "Every hour" },
  { id: "6h", value: "6h", label: "Every 6 hours" },
  { id: "12h", value: "12h", label: "Every 12 hours" },
  { id: "1d", value: "1d", label: "Every day" },
]

const promptPresets = [
  { id: "mem-maint", value: "fn:memory-maintenance", label: "Memory maintenance" },
  { id: "mem-export", value: "fn:memory-export", label: "Export memories to JSON" },
  {
    id: "ingest-doc",
    value: "fn:memory-ingest-doc docs/solutions/prompt-footer-modes-and-memory-ui.md",
    label: "Ingest solutions doc into memory",
  },
  { id: "custom", value: "", label: "Custom agent prompt..." },
]

function formatRelative(ms: number | undefined) {
  if (ms === undefined) return "Never"
  if (ms <= 0) return "Due now"
  const min = Math.round(ms / 60000)
  if (min < 60) return `in ${min}m`
  const hr = Math.round(min / 60)
  if (hr < 48) return `in ${hr}h`
  return `in ${Math.round(hr / 24)}d`
}

function formatLastRun(ts: number | undefined) {
  if (!ts) return "Never"
  return new Date(ts).toLocaleString()
}

export function SettingsHeartbeat() {
  const language = useLanguage()
  const { http, directory } = useLearningHttp()
  const [busy, setBusy] = createSignal(false)
  const [draft, setDraft] = createSignal<HeartbeatTask[]>([])
  const [newInterval, setNewInterval] = createSignal("1d")
  const [newName, setNewName] = createSignal("")
  const [presetId, setPresetId] = createSignal("mem-maint")
  const [customPrompt, setCustomPrompt] = createSignal("")

  const [state, { refetch }] = createResource(() => {
    const dir = directory()
    if (!dir) return Promise.reject(new Error("Open a project first."))
    return fetchHeartbeatSettingsState(http, dir).then((s) => {
      setDraft(s.tasks)
      return s
    })
  })

  const tasks = createMemo(() => draft())

  const saveTasks = async (next: HeartbeatTask[]) => {
    setBusy(true)
    try {
      const saved = await saveHeartbeatSettingsState(http, {
        tasks: next.map((t) => ({ enabled: t.enabled, interval: t.interval, taskName: t.taskName, prompt: t.prompt })),
      })
      setDraft(saved.tasks)
      await refetch()
      showToast({ title: language.t("settings.heartbeat.saved") })
    } catch (e) {
      showToast({ title: String(e) })
    } finally {
      setBusy(false)
    }
  }

  const initFile = async () => {
    setBusy(true)
    try {
      const saved = await initHeartbeatSettingsState(http)
      setDraft(saved.tasks)
      await refetch()
      showToast({ title: language.t("settings.heartbeat.initialized") })
    } catch (e) {
      showToast({ title: String(e) })
    } finally {
      setBusy(false)
    }
  }

  const resolvedPrompt = () => {
    if (presetId() === "custom") return customPrompt().trim()
    return promptPresets.find((p) => p.id === presetId())?.value ?? ""
  }

  const addTask = () => {
    const name = newName().trim().replace(/\s+/g, "-").toLowerCase()
    if (!name) {
      showToast({ title: language.t("settings.heartbeat.nameRequired") })
      return
    }
    const prompt = resolvedPrompt()
    if (!prompt) {
      showToast({ title: language.t("settings.heartbeat.promptRequired") })
      return
    }
    const next = [
      ...tasks(),
      { enabled: true, interval: newInterval(), taskName: name, prompt },
    ]
    setDraft(next)
    void saveTasks(next)
    setNewName("")
  }

  const removeTask = (taskName: string) => {
    const next = tasks().filter((t) => t.taskName !== taskName)
    setDraft(next)
    void saveTasks(next)
  }

  const updateTask = (taskName: string, patch: Partial<HeartbeatTask>) => {
    const next = tasks().map((t) => (t.taskName === taskName ? { ...t, ...patch } : t))
    setDraft(next)
    void saveTasks(next)
  }

  return (
    <SettingsLearningShell
      title={language.t("settings.tab.heartbeat")}
      description={language.t("settings.heartbeat.description")}
      titleTooltip={settingsTip(language, "settings.heartbeat.tooltip.page")}
      loading={state.loading && !state()}
      error={state.error}
      onRetry={refetch}
    >
      <Show when={!directory()}>
        <SettingsNoProject message={language.t("settings.learning.noProject")} />
      </Show>

      <Show when={directory()}>
        <Show when={state()}>
          {(s) => (
          <div class="flex flex-col gap-8 w-full">
            <section class="flex flex-col gap-2">
              <div class="bg-surface-base px-4 py-3 rounded-lg flex flex-col gap-2">
                <div class="text-12-regular text-text-weak break-all">{s().path}</div>
                <p class="text-12-regular text-text-weak">{language.t("settings.heartbeat.fileNote")}</p>
                <Show when={!s().exists}>
                  <Button size="small" variant="secondary" disabled={busy()} onClick={initFile}>
                    {language.t("settings.heartbeat.createDefault")}
                  </Button>
                </Show>
              </div>
            </section>

            <section class="flex flex-col gap-2">
              <SettingsSectionTitle
                title={language.t("settings.heartbeat.tasksTitle")}
                tooltip={settingsTip(language, "settings.heartbeat.tooltip.tasks")}
              />
              <Show
                when={tasks().length > 0}
                fallback={<p class="text-12-regular text-text-weaker">{language.t("settings.heartbeat.empty")}</p>}
              >
                <div class="flex flex-col gap-2">
                  <For each={tasks()}>
                    {(task) => (
                      <div class="p-3 rounded-lg border border-border-weaker-base flex flex-col gap-2">
                        <div class="flex items-start justify-between gap-2">
                          <div class="flex flex-col gap-0.5 min-w-0">
                            <span class="text-12-medium text-text-strong">{task.taskName}</span>
                            <span class="text-11-regular text-text-weak">
                              Every {task.interval} · {task.enabled ? "Active" : "Paused"}
                            </span>
                          </div>
                          <Switch
                            checked={task.enabled}
                            onChange={(v) => updateTask(task.taskName, { enabled: v })}
                            disabled={busy()}
                          />
                        </div>
                        <code class="text-10-regular text-text-weaker break-all bg-surface-raised-base px-2 py-1 rounded">
                          {task.prompt}
                        </code>
                        <div class="text-10-regular text-text-weaker flex flex-wrap gap-3">
                          <span>Last: {formatLastRun(task.lastRun)}</span>
                          <span>Next: {formatRelative(task.nextRunInMs)}</span>
                        </div>
                        <Button
                          size="small"
                          variant="ghost"
                          class="self-start"
                          disabled={busy()}
                          onClick={() => removeTask(task.taskName)}
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </section>

            <section class="flex flex-col gap-2">
              <SettingsSectionTitle
                title={language.t("settings.heartbeat.addTitle")}
                tooltip={settingsTip(language, "settings.heartbeat.tooltip.add")}
              />
              <div class="bg-surface-base px-4 py-3 rounded-lg flex flex-col gap-3">
                <div class="flex items-center gap-1">
                  <span class="text-12-medium text-text-strong">{language.t("settings.heartbeat.taskName")}</span>
                  <SettingsHelpTrigger
                    tooltip={settingsTip(language, "settings.heartbeat.tooltip.taskName")}
                    label={language.t("settings.heartbeat.taskName")}
                  />
                </div>
                <TextField
                  label={language.t("settings.heartbeat.taskName")}
                  hideLabel
                  value={newName()}
                  onChange={setNewName}
                  placeholder="memory-maintenance"
                />
                <div class="flex flex-col gap-1">
                  <div class="flex items-center gap-1">
                    <span class="text-12-medium text-text-strong">{language.t("settings.heartbeat.interval")}</span>
                    <SettingsHelpTrigger
                      tooltip={settingsTip(language, "settings.heartbeat.tooltip.interval")}
                      label={language.t("settings.heartbeat.interval")}
                    />
                  </div>
                  <Select
                    options={intervalPresets}
                    current={intervalPresets.find((o) => o.value === newInterval())}
                    value={(o) => o.value}
                    label={(o) => o.label}
                    onSelect={(o) => {
                      if (o) setNewInterval(o.value)
                    }}
                    variant="secondary"
                    size="small"
                    triggerVariant="settings"
                  />
                </div>
                <div class="flex flex-col gap-1">
                  <div class="flex items-center gap-1">
                    <span class="text-12-medium text-text-strong">{language.t("settings.heartbeat.action")}</span>
                    <SettingsHelpTrigger
                      tooltip={settingsTip(language, "settings.heartbeat.tooltip.action")}
                      label={language.t("settings.heartbeat.action")}
                    />
                  </div>
                  <Select
                    options={promptPresets}
                    current={promptPresets.find((o) => o.id === presetId()) ?? promptPresets[0]}
                    value={(o) => o.id}
                    label={(o) => o.label}
                    onSelect={(o) => {
                      if (!o) return
                      setPresetId(o.id)
                    }}
                    variant="secondary"
                    size="small"
                    triggerVariant="settings"
                  />
                </div>
                <Show when={presetId() === "custom"}>
                  <TextField
                    label={language.t("settings.heartbeat.customPrompt")}
                    value={customPrompt()}
                    onChange={setCustomPrompt}
                    placeholder="fn:memory-maintenance or free-form agent prompt"
                  />
                </Show>
                <Button size="small" variant="secondary" disabled={busy()} onClick={addTask}>
                  {language.t("settings.heartbeat.addTask")}
                </Button>
              </div>
            </section>

            <section class="flex flex-col gap-1">
              <SettingsSectionTitle
                title={language.t("settings.heartbeat.helpTitle")}
                tooltip={settingsTip(language, "settings.heartbeat.tooltip.help")}
              />
              <p class="text-12-regular text-text-weak whitespace-pre-line">{language.t("settings.heartbeat.helpBody")}</p>
            </section>
          </div>
          )}
        </Show>
      </Show>
    </SettingsLearningShell>
  )
}
