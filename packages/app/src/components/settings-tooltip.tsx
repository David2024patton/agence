import { For, Show, type JSX } from "solid-js"
import { Icon } from "@agence-ai/ui/icon"
import { Tooltip } from "@agence-ai/ui/tooltip"

export function SettingsTooltipBody(props: { body: string; examples?: string[] }) {
  return (
    <div class="settings-tooltip-body">
      <p>{props.body}</p>
      <Show when={props.examples && props.examples.length > 0}>
        <p class="settings-tooltip-examples-title">Examples</p>
        <ul class="settings-tooltip-examples">
          <For each={props.examples}>{(line) => <li>{line}</li>}</For>
        </ul>
      </Show>
    </div>
  )
}

function tooltipExamples(language: { t: (key: string) => string }, prefix: string) {
  return [1, 2, 3]
    .map((n) => {
      const key = `${prefix}.ex${n}`
      const value = language.t(key)
      return value === key ? undefined : value
    })
    .filter((value): value is string => Boolean(value))
}

export function settingsTip(language: { t: (key: string) => string }, prefix: string) {
  const bodyKey = `${prefix}.body`
  const body = language.t(bodyKey)
  const examples = tooltipExamples(language, prefix)
  return <SettingsTooltipBody body={body} examples={examples.length > 0 ? examples : undefined} />
}

/** Uses dedicated tooltip copy when present; otherwise description plus optional examples under prefix. */
export function rowTooltip(
  language: { t: (key: string) => string },
  prefix: string,
  fallbackDescription?: string,
) {
  const bodyKey = `${prefix}.body`
  let body = language.t(bodyKey)
  if (body === bodyKey) body = fallbackDescription ?? bodyKey
  const examples = tooltipExamples(language, prefix)
  return <SettingsTooltipBody body={body} examples={examples.length > 0 ? examples : undefined} />
}

export function SettingsHelpTrigger(props: { tooltip: JSX.Element; label?: string }) {
  return (
    <Tooltip value={props.tooltip} placement="top" openDelay={250} closeDelay={100} contentClass="settings-tooltip-popover">
      <button
        type="button"
        class="settings-row-help"
        aria-label={props.label ?? "More information"}
      >
        <Icon name="help" size="small" />
      </button>
    </Tooltip>
  )
}
