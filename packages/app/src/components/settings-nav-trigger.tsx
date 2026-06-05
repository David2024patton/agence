import type { JSX } from "solid-js"
import type { Component } from "solid-js"
import { Tabs } from "@agence-ai/ui/tabs"
import { useLanguage } from "@/context/language"

export const SettingsNavTrigger: Component<{
  value: string
  tooltipKey: string
  children: JSX.Element
  class?: string
}> = (props) => {
  const language = useLanguage()
  const title = () => {
    const key = `${props.tooltipKey}.body`
    const value = language.t(key)
    return value === key ? undefined : value
  }

  return (
    <Tabs.Trigger value={props.value} class={props.class} title={title()}>
      {props.children}
    </Tabs.Trigger>
  )
}
