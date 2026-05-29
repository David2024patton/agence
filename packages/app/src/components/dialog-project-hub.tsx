import { createEffect, createResource, createSignal, For, Show, type Component } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { base64Encode } from "@agence-ai/core/util/encode"
import { Dialog } from "@agence-ai/ui/dialog"
import { Button } from "@agence-ai/ui/button"
import { Switch } from "@agence-ai/ui/switch"
import { TextField } from "@agence-ai/ui/text-field"
import { Tag } from "@agence-ai/ui/tag"
import { Icon } from "@agence-ai/ui/icon"
import { useGlobalSDK } from "@/context/global-sdk"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { useLanguage } from "@/context/language"
import {
  fetchHubState,
  installFromGithub,
  saveHubGroups,
  toggleHubGroup,
  updateHubManifest,
  uploadHubResource,
  type HubState,
} from "@/utils/hub-api"

function HubSection(props: { title: string; icon?: string; children: any }) {
  return (
    <section class="flex flex-col gap-3">
      <div class="flex items-center gap-2 pb-2 border-b border-border-weak-base">
        <Show when={props.icon}>
          <Icon name={props.icon as any} class="text-text-weak w-4 h-4" />
        </Show>
        <h2 class="text-13-medium text-text-strong">{props.title}</h2>
      </div>
      {props.children}
    </section>
  )
}

export const DialogProjectHub: Component<{ directory: string }> = (props) => {
  const language = useLanguage()
  const gsdk = useGlobalSDK()
  const platform = usePlatform()
  const server = useServer()
  const navigate = useNavigate()

  const httpOpts = () => ({
    baseUrl: gsdk.url,
    server: server.current,
    directory: props.directory,
    fetch: platform.fetch,
  })

  const [goal, setGoal] = createSignal("")
  const [githubRef, setGithubRef] = createSignal("")
  const [installType, setInstallType] = createSignal<"skill" | "persona" | "mcp" | "plugin">("skill")
  const [uploadName, setUploadName] = createSignal("")
  const [uploadContent, setUploadContent] = createSignal("")
  const [groupName, setGroupName] = createSignal("")
  const [groupSkills, setGroupSkills] = createSignal<string[]>([])

  const [hub, { refetch }] = createResource(
    () => ({ dir: props.directory, base: gsdk.url }),
    async ({ dir, base }) => {
      if (!dir || !base) return undefined
      return fetchHubState({ ...httpOpts(), directory: dir, baseUrl: base })
    },
  )

  createEffect(() => {
    const value = hub()?.manifest.goal
    if (value !== undefined) setGoal(value)
  })

  const setPersona = async (personaID: string) => {
    if (!props.directory || !gsdk.url) return
    await updateHubManifest({ ...httpOpts(), manifest: { persona_id: personaID } })
    void refetch()
  }

  const saveGoal = async () => {
    if (!props.directory || !gsdk.url) return
    await updateHubManifest({ ...httpOpts(), manifest: { goal: goal() } })
    void refetch()
  }

  const toggleGroup = async (groupID: string, enabled: boolean) => {
    if (!props.directory || !gsdk.url) return
    await toggleHubGroup({ ...httpOpts(), groupID, enabled })
    void refetch()
  }

  const installGithub = async () => {
    const ref = githubRef().trim()
    if (!props.directory || !gsdk.url || !ref) return
    await installFromGithub({ ...httpOpts(), type: installType(), github: ref })
    setGithubRef("")
    void refetch()
  }

  const uploadResource = async () => {
    const name = uploadName().trim()
    const content = uploadContent().trim()
    if (!props.directory || !gsdk.url || !name || !content) return
    await uploadHubResource({ ...httpOpts(), type: installType(), name, content })
    setUploadName("")
    setUploadContent("")
    void refetch()
  }

  const createGroup = async () => {
    const name = groupName().trim()
    if (!props.directory || !gsdk.url || !name) return
    const state = hub()
    if (!state) return
    const custom = state.groups.filter((group) => !group.builtin)
    const id = name.toLowerCase().replace(/[^a-z0-9-_]+/g, "-")
    const persona = state.personas.find((item) => item.active)?.id ?? "build"
    await saveHubGroups({
      ...httpOpts(),
      groups: [
        ...custom.map((group) => ({
          id: group.id,
          name: group.name,
          description: group.description,
          items: group.items,
        })),
        {
          id,
          name,
          items: [
            { type: "persona", ref: persona },
            ...groupSkills().map((skill) => ({ type: "skill", ref: skill })),
          ],
        },
      ],
    })
    setGroupName("")
    setGroupSkills([])
    await toggleHubGroup({ ...httpOpts(), groupID: id, enabled: true })
    void refetch()
  }

  const toggleSkillForGroup = (skillID: string) => {
    setGroupSkills((current) =>
      current.includes(skillID) ? current.filter((item) => item !== skillID) : [...current, skillID],
    )
  }

  return (
    <Dialog size="x-large" transition>
      <div class="h-full flex flex-col min-h-0">
        {/* Header */}
        <div class="flex items-start justify-between px-6 pt-6 pb-4 border-b border-border-weak-base shrink-0">
          <div class="flex flex-col gap-1">
            <h1 class="text-16-medium text-text-strong">{language.t("hub.title")}</h1>
            <p class="text-13-regular text-text-weak">{language.t("hub.subtitle")}</p>
            <Show when={props.directory}>
              <code class="text-11-regular text-text-weak break-all mt-1">{props.directory}</code>
            </Show>
          </div>
        </div>

        {/* Scrollable body - two-column layout */}
        <div class="flex-1 min-h-0 overflow-y-auto settings-scrollbar">
          <Show when={hub.error}>
            <div class="px-6 pt-4 text-14-regular text-text-critical">{String(hub.error)}</div>
          </Show>

          <Show when={hub()} keyed>
            {(state: HubState) => (
              <div class="px-6 py-5 grid grid-cols-2 gap-x-8 gap-y-6">
                {/* Left column */}
                <div class="flex flex-col gap-6">
                  <HubSection title={language.t("hub.section.overview")} icon="info">
                    <TextField label={language.t("hub.goal.label")} value={goal()} onChange={setGoal} />
                    <Button variant="primary" size="small" onClick={() => void saveGoal()}>
                      {language.t("common.save")}
                    </Button>
                    <div class="text-12-regular text-text-weak">{state.mcpServe.note}</div>
                    <code class="text-11-regular bg-surface-raised-base p-2 rounded break-all">
                      {state.mcpServe.stdio.replace("<path>", props.directory)}
                    </code>
                  </HubSection>

                  <HubSection title={language.t("hub.section.persona")} icon="agent">
                    <For each={state.personas.filter((p) => p.mode === "primary" || p.mode === "all" || !p.mode)}>
                      {(persona) => (
                        <button
                          type="button"
                          class="flex items-center justify-between w-full text-left py-2 px-3 rounded-md hover:bg-surface-raised-base-hover transition-colors border border-transparent"
                          classList={{ "border-border-base bg-surface-raised-base": persona.active }}
                          onClick={() => void setPersona(persona.id)}
                        >
                          <div>
                            <div class="text-13-medium text-text-strong">{persona.name}</div>
                            <Show when={persona.description}>
                              <div class="text-12-regular text-text-weak">{persona.description}</div>
                            </Show>
                          </div>
                          <Show when={persona.active}>
                            <Tag>{language.t("hub.tag.active")}</Tag>
                          </Show>
                        </button>
                      )}
                    </For>
                  </HubSection>

                  <HubSection title={language.t("hub.section.groups")} icon="models">
                    <For each={state.groups}>
                      {(group) => (
                        <div class="flex items-center justify-between gap-4 py-2 border-b border-border-weak-base last:border-none">
                          <div>
                            <div class="text-13-medium text-text-strong">{group.name}</div>
                            <Show when={group.description}>
                              <div class="text-12-regular text-text-weak">{group.description}</div>
                            </Show>
                          </div>
                          <Switch
                            checked={group.enabled ?? false}
                            onChange={(checked) => void toggleGroup(group.id, checked)}
                            hideLabel
                          >
                            {group.name}
                          </Switch>
                        </div>
                      )}
                    </For>
                  </HubSection>
                </div>

                {/* Right column */}
                <div class="flex flex-col gap-6">
                  <HubSection title={language.t("hub.section.skills")} icon="file">
                    <div class="flex flex-col gap-1 max-h-48 overflow-y-auto settings-scrollbar">
                      <For each={state.skills}>
                        {(skill) => (
                          <div class="flex items-center justify-between py-1.5">
                            <span class="text-13-regular text-text-base">{skill.name}</span>
                            <Show when={skill.enabled}>
                              <Tag>{language.t("hub.tag.enabled")}</Tag>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                  </HubSection>

                  <HubSection title={language.t("hub.section.mcps")} icon="mcp">
                    <For each={state.mcps}>
                      {(mcp) => (
                        <div class="flex items-center gap-2 py-1.5">
                          <span class="text-13-regular text-text-base">{mcp.name}</span>
                          <Tag>{mcp.status}</Tag>
                        </div>
                      )}
                    </For>
                  </HubSection>

                  <HubSection title={language.t("hub.section.threads")} icon="session">
                    <div class="flex flex-col gap-1 max-h-40 overflow-y-auto settings-scrollbar">
                      <For each={state.threads}>
                        {(thread) => (
                          <button
                            type="button"
                            class="flex items-center gap-2 w-full text-left py-2 hover:bg-surface-raised-base-hover rounded px-2 transition-colors"
                            onClick={() => navigate(`/${base64Encode(props.directory)}/session/${thread.id}`)}
                          >
                            <Tag>{thread.kind}</Tag>
                            <span class="text-13-regular text-text-base truncate">{thread.title}</span>
                          </button>
                        )}
                      </For>
                    </div>
                  </HubSection>

                  <HubSection title={language.t("hub.section.install")} icon="download">
                    <div class="flex gap-1.5 flex-wrap">
                      <For each={(["skill", "persona", "mcp", "plugin"] as const)}>
                        {(type) => (
                          <Button
                            variant={installType() === type ? "primary" : "secondary"}
                            size="small"
                            onClick={() => setInstallType(type)}
                          >
                            {type}
                          </Button>
                        )}
                      </For>
                    </div>
                    <TextField
                      label={language.t("hub.install.github")}
                      placeholder="owner/repo or owner/repo/path/to/skill"
                      value={githubRef()}
                      onChange={setGithubRef}
                    />
                    <Button variant="primary" size="small" onClick={() => void installGithub()}>
                      {language.t("hub.install.action")}
                    </Button>
                  </HubSection>

                  <HubSection title={language.t("hub.section.upload")} icon="upload">
                    <TextField label={language.t("hub.upload.name")} value={uploadName()} onChange={setUploadName} />
                    <label class="flex flex-col gap-1">
                      <span class="text-12-medium text-text-base">{language.t("hub.upload.content")}</span>
                      <textarea
                        class="min-h-24 rounded-md border border-border-weak-base bg-surface-base p-3 text-12-regular text-text-base resize-none"
                        value={uploadContent()}
                        onInput={(event) => setUploadContent(event.currentTarget.value)}
                      />
                    </label>
                    <Button variant="primary" size="small" onClick={() => void uploadResource()}>
                      {language.t("hub.upload.action")}
                    </Button>
                  </HubSection>
                </div>

                {/* Full-width quick links at bottom */}
                <div class="col-span-2 flex gap-2 flex-wrap pt-2 border-t border-border-weak-base">
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => navigate(`/library?directory=${encodeURIComponent(props.directory)}`)}
                  >
                    <Icon name="archive" />
                    {language.t("hub.link.knowledge")}
                  </Button>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => window.dispatchEvent(new CustomEvent("agence:open-memory-settings"))}
                  >
                    <Icon name="brain" />
                    {language.t("hub.link.memory")}
                  </Button>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => navigate(`/${base64Encode(props.directory)}/session`)}
                  >
                    <Icon name="bubble-5" />
                    {language.t("hub.link.sessions")}
                  </Button>
                </div>
              </div>
            )}
          </Show>

          <Show when={!hub() && !hub.error && !hub.loading}>
            <div class="px-6 py-8 text-14-regular text-text-weak text-center">
              {language.t("settings.learning.noProject")}
            </div>
          </Show>

          <Show when={hub.loading}>
            <div class="px-6 py-8 text-14-regular text-text-weak text-center">
              {language.t("common.loading")}
            </div>
          </Show>
        </div>
      </div>
    </Dialog>
  )
}
