import { createResource, For, Show } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { Button } from "@agence-ai/ui/button"
import { useLanguage } from "@/context/language"
import { useLearningHttp } from "@/utils/settings-learning"
import { fetchKnowledgeSettingsState } from "@/utils/learning-settings-api"
import { SettingsNoProject } from "./settings-learning-shell"

export function SettingsKnowledgePanel() {
  const language = useLanguage()
  const navigate = useNavigate()
  const { http, directory } = useLearningHttp()

  const [state, { refetch }] = createResource(() => fetchKnowledgeSettingsState(http))

  const openLibrary = () => {
    const dir = directory()
    if (!dir) return
    navigate(`/library?directory=${encodeURIComponent(dir)}`)
  }

  return (
    <>
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
                <div class="text-14-medium text-text-strong">
                  {language.t("settings.knowledge.articleCount", { count: String(s().articleCount) })}
                </div>
                <p class="text-12-regular text-text-weak">{language.t("settings.knowledge.wikiNote")}</p>
                <div class="flex flex-wrap gap-2 pt-1">
                  <Button size="small" variant="secondary" onClick={openLibrary}>
                    {language.t("settings.knowledge.openLibrary")}
                  </Button>
                  <Button size="small" variant="ghost" onClick={() => refetch()}>
                    Refresh
                  </Button>
                </div>
              </div>
            </section>

            <section class="flex flex-col gap-2">
              <h3 class="text-14-medium text-text-strong">{language.t("settings.knowledge.articlesTitle")}</h3>
              <Show
                when={s().files.length > 0}
                fallback={<p class="text-12-regular text-text-weaker">{language.t("settings.knowledge.empty")}</p>}
              >
                <div class="flex flex-col gap-1">
                  <For each={s().files.slice(0, 30)}>
                    {(file) => (
                      <div class="p-2 rounded-md border border-border-weaker-base flex items-center justify-between gap-2">
                        <span class="text-12-medium text-text-strong truncate">
                          {file.name.replace(/\.md$/, "").replace(/-/g, " ")}
                        </span>
                        <span class="text-10-regular text-text-weaker shrink-0">
                          {language.t("settings.knowledge.linkCount", { count: String(file.links.length) })}
                        </span>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </section>

            <section class="flex flex-col gap-1">
              <h3 class="text-14-medium text-text-strong pb-1">{language.t("settings.knowledge.howTitle")}</h3>
              <p class="text-12-regular text-text-weak">{language.t("settings.knowledge.howBody")}</p>
            </section>
          </div>
          )}
        </Show>
      </Show>

      <Show when={directory() && state.loading && !state()}>
        <p class="text-12-regular text-text-weaker py-4 text-center">Loading...</p>
      </Show>

      <Show when={directory() && state.error}>
        <p class="text-12-regular text-text-critical py-2">{String(state.error)}</p>
      </Show>
    </>
  )
}
