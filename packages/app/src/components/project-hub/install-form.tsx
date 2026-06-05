import { createSignal, Show, type Component } from "solid-js"
import { Button } from "@agence-ai/ui/button"
import { TextField } from "@agence-ai/ui/text-field"
import { showToast } from "@agence-ai/ui/toast"
import { useLanguage } from "@/context/language"
import { installFromGithub, uploadHubResource } from "@/utils/hub-api"
import type { HubResourceType } from "./types"
import type { HubHttpOpts } from "./use-project-hub"
import { HubPanel } from "./shared"

export const HubInstallForm: Component<{
  type: HubResourceType
  httpOpts: () => HubHttpOpts
  onDone: () => void
}> = (props) => {
  const language = useLanguage()
  const [mode, setMode] = createSignal<"github" | "upload">("github")
  const [githubRef, setGithubRef] = createSignal("")
  const [subpath, setSubpath] = createSignal("")
  const [displayName, setDisplayName] = createSignal("")
  const [uploadName, setUploadName] = createSignal("")
  const [uploadContent, setUploadContent] = createSignal("")
  const [busy, setBusy] = createSignal(false)

  const installGithub = async () => {
    const ref = githubRef().trim()
    const opts = props.httpOpts()
    if (!opts.directory || !opts.baseUrl || !ref || busy()) return
    setBusy(true)
    try {
      await installFromGithub({
        ...opts,
        type: props.type,
        github: ref,
        subpath: subpath().trim() || undefined,
        name: displayName().trim() || undefined,
      })
      setGithubRef("")
      setSubpath("")
      setDisplayName("")
      props.onDone()
    } catch (error) {
      showToast({
        variant: "error",
        title: language.t("common.requestFailed"),
        description: error instanceof Error ? error.message : language.t("hub.install.failed"),
      })
    } finally {
      setBusy(false)
    }
  }

  const uploadResource = async () => {
    const name = uploadName().trim()
    const content = uploadContent().trim()
    const opts = props.httpOpts()
    if (!opts.directory || !opts.baseUrl || !name || !content || busy()) return
    setBusy(true)
    try {
      await uploadHubResource({ ...opts, type: props.type, name, content })
      setUploadName("")
      setUploadContent("")
      props.onDone()
    } catch (error) {
      showToast({
        variant: "error",
        title: language.t("common.requestFailed"),
        description: error instanceof Error ? error.message : language.t("hub.upload.failed"),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div class="flex flex-col gap-2 mt-4">
      <div class="flex gap-1">
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-11-medium transition-colors"
          classList={{
            "bg-surface-base text-text-strong": mode() === "github",
            "text-text-weak hover:text-text-base": mode() !== "github",
          }}
          onClick={() => setMode("github")}
        >
          {language.t("hub.install.githubTitle")}
        </button>
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-11-medium transition-colors"
          classList={{
            "bg-surface-base text-text-strong": mode() === "upload",
            "text-text-weak hover:text-text-base": mode() !== "upload",
          }}
          onClick={() => setMode("upload")}
        >
          {language.t("hub.upload.title")}
        </button>
      </div>

      <HubPanel>
        <div class="p-3 flex flex-col gap-2">
          <Show when={mode() === "github"}>
            <p class="text-11-regular text-text-weak">{language.t("hub.install.githubHint")}</p>
            <TextField
              label={language.t("hub.install.github")}
              placeholder="https://github.com/owner/repo or owner/repo/tree/main/path"
              value={githubRef()}
              onChange={setGithubRef}
            />
            <TextField
              label={language.t("hub.install.subpath")}
              placeholder=".opencode/skills/my-skill"
              value={subpath()}
              onChange={setSubpath}
            />
            <TextField
              label={language.t("hub.install.name")}
              placeholder={language.t("hub.install.namePlaceholder")}
              value={displayName()}
              onChange={setDisplayName}
            />
            <Button variant="primary" size="small" disabled={busy()} onClick={() => void installGithub()}>
              {language.t("hub.install.action")}
            </Button>
          </Show>
          <Show when={mode() === "upload"}>
            <p class="text-11-regular text-text-weak">{language.t("hub.upload.hint")}</p>
            <TextField label={language.t("hub.upload.name")} value={uploadName()} onChange={setUploadName} />
            <textarea
              class="min-h-20 rounded-md border border-border-weak-base bg-surface-base p-2 text-12-regular text-text-base resize-none"
              placeholder={language.t("hub.upload.content")}
              value={uploadContent()}
              onInput={(event) => setUploadContent(event.currentTarget.value)}
            />
            <Button variant="secondary" size="small" disabled={busy()} onClick={() => void uploadResource()}>
              {language.t("hub.upload.action")}
            </Button>
          </Show>
        </div>
      </HubPanel>
    </div>
  )
}