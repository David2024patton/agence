import { createContext, useContext, type ParentProps } from "solid-js"

const SettingsProjectDirectory = createContext<string | undefined>()

export function SettingsProjectProvider(props: ParentProps & { directory?: string }) {
  return (
    <SettingsProjectDirectory.Provider value={props.directory}>{props.children}</SettingsProjectDirectory.Provider>
  )
}

export function useSettingsProjectDirectory() {
  return useContext(SettingsProjectDirectory)
}
