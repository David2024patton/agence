import { type JSX, Show } from "solid-js"
import type { Component } from "solid-js"
import { SettingsHelpTrigger } from "./settings-tooltip"

export const SettingsRow: Component<{
  title: string | JSX.Element
  description?: string | JSX.Element
  desc?: string | JSX.Element
  tooltip?: JSX.Element
  children: JSX.Element
}> = (props) => {
  const description = () => props.description ?? props.desc ?? ""

  return (
    <div class="flex flex-wrap items-center gap-4 py-3 border-b border-border-weak-base last:border-none sm:flex-nowrap">
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <div class="flex items-center gap-1 min-w-0">
          <span class="text-14-medium text-text-strong">{props.title}</span>
          <Show when={props.tooltip}>
            {(tooltip) => (
              <SettingsHelpTrigger
                tooltip={tooltip()}
                label={typeof props.title === "string" ? `About ${props.title}` : "More information"}
              />
            )}
          </Show>
        </div>
        <span class="text-12-regular text-text-weak">{description()}</span>
      </div>
      <div class="flex w-full justify-end sm:w-auto sm:shrink-0">{props.children}</div>
    </div>
  )
}

export const SettingsSectionTitle: Component<{
  title: string
  tooltip?: JSX.Element
}> = (props) => (
  <div class="flex items-center gap-1.5 pb-2">
    <h3 class="text-14-medium text-text-strong">{props.title}</h3>
    <Show when={props.tooltip}>
      {(tooltip) => <SettingsHelpTrigger tooltip={tooltip()} label={`About ${props.title}`} />}
    </Show>
  </div>
)
