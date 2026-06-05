import { Show, type Component, type JSX } from "solid-js"
import { Dynamic } from "solid-js/web"
import { Icon } from "@agence-ai/ui/icon"
import { Switch } from "@agence-ai/ui/switch"

export const HubPanel: Component<{ children: JSX.Element; class?: string }> = (props) => (
  <div
    class={`rounded-lg border border-border-weak-base bg-surface-raised-base overflow-hidden divide-y divide-border-weak-base ${props.class ?? ""}`}
  >
    {props.children}
  </div>
)

export const HubNavRow: Component<{
  icon: string
  title: string
  value?: string
  onClick: () => void
}> = (props) => (
  <button
    type="button"
    class="flex items-center gap-2.5 w-full text-left px-3 py-2 min-h-10 hover:bg-surface-raised-base-hover transition-colors"
    onClick={props.onClick}
  >
    <Icon name={props.icon as any} class="text-icon-base w-4 h-4 shrink-0" />
    <span class="text-13-medium text-text-strong flex-1 min-w-0 truncate">{props.title}</span>
    <Show when={props.value}>
      <span class="text-12-regular text-text-weak shrink-0 max-w-[40%] truncate">{props.value}</span>
    </Show>
    <Icon name="chevron-right" class="text-icon-weak w-3.5 h-3.5 shrink-0" />
  </button>
)

export const HubListRow: Component<{
  title: string
  subtitle?: string
  trailing?: JSX.Element
  onClick?: () => void
  active?: boolean
}> = (props) => (
  <Dynamic
    component={props.onClick ? "button" : "div"}
    type={props.onClick ? "button" : undefined}
    class="flex items-center gap-2 w-full text-left px-3 py-2 min-h-10"
    classList={{
      "hover:bg-surface-raised-base-hover transition-colors cursor-pointer": !!props.onClick,
      "bg-surface-base": props.active,
    }}
    onClick={props.onClick}
  >
    <div class="flex-1 min-w-0">
      <div class="text-13-medium text-text-strong truncate">{props.title}</div>
      <Show when={props.subtitle}>
        <div class="text-11-regular text-text-weak truncate">{props.subtitle}</div>
      </Show>
    </div>
    <Show when={props.trailing}>{props.trailing}</Show>
  </Dynamic>
)

export const HubSectionHint: Component<{ children: JSX.Element }> = (props) => (
  <p class="text-12-regular text-text-weak mb-3">{props.children}</p>
)

export const HubSelectableRow: Component<{
  title: string
  subtitle?: string
  checked: boolean
  locked?: boolean
  busy?: boolean
  onChange: (checked: boolean) => void
  trailing?: JSX.Element
}> = (props) => (
  <div class="flex items-center gap-2 w-full px-3 py-2 min-h-10">
    <div class="flex-1 min-w-0">
      <div class="text-13-medium text-text-strong truncate">{props.title}</div>
      <Show when={props.subtitle}>
        <div class="text-11-regular text-text-weak truncate">{props.subtitle}</div>
      </Show>
    </div>
    <Show when={props.trailing}>{props.trailing}</Show>
    <Switch
      checked={props.checked}
      disabled={props.locked || props.busy}
      onChange={props.onChange}
      hideLabel
    >
      {props.title}
    </Switch>
  </div>
)
