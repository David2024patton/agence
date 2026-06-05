import { type JSX, Show } from "solid-js"
import { Button } from "@agence-ai/ui/button"
import { SettingsHelpTrigger } from "./settings-tooltip"
export { SettingsRow, SettingsSectionTitle } from "./settings-row"

export function SettingsLearningShell(props: {
  title: string
  description: string
  titleTooltip?: JSX.Element
  loading?: boolean
  error?: unknown
  onRetry?: () => void
  children: JSX.Element
}) {
  return (
    <div class="flex flex-col h-full overflow-y-auto settings-scrollbar px-4 pb-10 sm:px-10 sm:pb-10">
      <div class="sticky top-0 z-10 bg-[linear-gradient(to_bottom,var(--surface-stronger-non-alpha)_calc(100%_-_24px),transparent)]">
        <div class="flex flex-col gap-1 pt-6 pb-8">
          <div class="flex items-center gap-1.5">
            <h2 class="text-16-medium text-text-strong">{props.title}</h2>
            <Show when={props.titleTooltip}>
              {(tip) => <SettingsHelpTrigger tooltip={tip()} label={`About ${props.title}`} />}
            </Show>
          </div>

          <p class="text-12-regular text-text-weak">{props.description}</p>
        </div>
      </div>

      <Show when={props.error}>
        <div class="flex flex-col gap-2 py-2">
          <p class="text-12-regular text-text-critical">{String(props.error)}</p>
          <Show when={props.onRetry}>
            {(retry) => (
              <Button size="small" variant="secondary" onClick={retry()}>
                Retry
              </Button>
            )}
          </Show>
        </div>
      </Show>

      <Show when={props.loading && !props.error}>
        <p class="text-12-regular text-text-weaker py-8 text-center">Loading...</p>
      </Show>

      <Show when={!props.error && !props.loading}>{props.children}</Show>
    </div>
  )
}

export function SettingsNoProject(props: { message: string }) {
  return <p class="text-12-regular text-text-weak py-4">{props.message}</p>
}
