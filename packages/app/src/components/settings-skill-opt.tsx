import { For, Show, createResource, createSignal } from "solid-js"
import { Button } from "@agence-ai/ui/button"
import { Switch } from "@agence-ai/ui/switch"
import { useLanguage } from "@/context/language"
import { useLearningHttp } from "@/utils/settings-learning"
import { SettingsLearningShell, SettingsNoProject, SettingsRow, SettingsSectionTitle } from "./settings-learning-shell"
import { rowTooltip, settingsTip, SettingsHelpTrigger } from "./settings-tooltip"
import { fetchSkillOptState, saveSkillOptSettings, runSkillOpt } from "@/utils/learning-settings-api"

export function SettingsSkillOpt() {
  const language = useLanguage()
  const { http, directory } = useLearningHttp()
  const [busy, setBusy] = createSignal(false)
  const [state, { refetch }] = createResource(async () => {
    if (!directory()) return undefined
    return fetchSkillOptState(http)
  })

  const save = async (patch: Parameters<typeof saveSkillOptSettings>[1]) => {
    const current = state()
    if (!current) return
    setBusy(true)
    try {
      await saveSkillOptSettings(http, { ...current.settings, ...patch })
      await refetch()
    } finally {
      setBusy(false)
    }
  }

  const runNow = async () => {
    setBusy(true)
    try {
      await runSkillOpt(http)
      await refetch()
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsLearningShell
      title={language.t("settings.skillOpt.title")}
      description={language.t("settings.skillOpt.description")}
      titleTooltip={settingsTip(language, "settings.skillOpt.about")}
      loading={state.loading}
      error={state.error}
      onRetry={() => refetch()}
    >
      <Show when={directory()} fallback={<SettingsNoProject message={language.t("settings.skillOpt.noProject")} />}>
        <Show when={state()}>
          {(overview) => (
            <div class="flex flex-col gap-6 pb-8">
              <SettingsSectionTitle title={language.t("settings.skillOpt.section.automation")} />
              <SettingsRow
                title={language.t("settings.skillOpt.enabled")}
                description={language.t("settings.skillOpt.enabledHelp")}
                tooltip={rowTooltip(language, "settings.skillOpt.enabledTip")}
              >
                <Switch
                  checked={overview().settings.enabled !== false}
                  disabled={busy()}
                  onChange={(value) => save({ enabled: value })}
                />
              </SettingsRow>
              <SettingsRow
                title={language.t("settings.skillOpt.autoAfterSession")}
                description={language.t("settings.skillOpt.autoAfterSessionHelp")}
                tooltip={rowTooltip(language, "settings.skillOpt.autoAfterSessionTip")}
              >
                <Switch
                  checked={overview().settings.autoAfterSession !== false}
                  disabled={busy() || overview().settings.enabled === false}
                  onChange={(value) => save({ autoAfterSession: value })}
                />
              </SettingsRow>

              <SettingsSectionTitle title={language.t("settings.skillOpt.section.status")} />
              <div class="text-12-regular text-text-weak flex flex-col gap-1">
                <div>
                  {language.t("settings.skillOpt.skillsFound")}: {overview().skills.length}
                </div>
                <div>
                  {language.t("settings.skillOpt.accepted")}: {overview().acceptedCount} ·{" "}
                  {language.t("settings.skillOpt.rejected")}: {overview().rejectedCount}
                </div>
              </div>

              <Show when={overview().skills.length > 0}>
                <div class="flex flex-col gap-1">
                  <For each={overview().skills}>
                    {(skill) => (
                      <div class="text-12-regular text-text-base flex items-center justify-between gap-2 py-1">
                        <span class="truncate">{skill.name}</span>
                        <span class="text-text-weak shrink-0">v{skill.version}</span>
                      </div>
                    )}
                  </For>
                </div>
              </Show>

              <div class="flex items-center gap-2 pt-2">
                <Button size="small" disabled={busy() || overview().settings.enabled === false} onClick={runNow}>
                  {language.t("settings.skillOpt.runNow")}
                </Button>
                <SettingsHelpTrigger
                  label={language.t("settings.skillOpt.runNow")}
                  tooltip={settingsTip(language, "settings.skillOpt.runNowTip")}
                />
              </div>

              <p class="text-11-regular text-text-weaker">{language.t("settings.skillOpt.heartbeatHint")}</p>
            </div>
          )}
        </Show>
      </Show>
    </SettingsLearningShell>
  )
}
