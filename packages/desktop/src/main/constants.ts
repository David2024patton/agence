import { app } from "electron"

type Channel = "dev" | "beta" | "prod"
const raw = import.meta.env.AGENCE_CHANNEL
export const CHANNEL: Channel = raw === "dev" || raw === "beta" || raw === "prod" ? raw : "dev"

export const SETTINGS_STORE = "agence.settings"
export const DEFAULT_SERVER_URL_KEY = "defaultServerUrl"
export const WSL_ENABLED_KEY = "wslEnabled"
export const EXTERNAL_SERVER_KEY = "externalServer"
export const PINCH_ZOOM_ENABLED_KEY = "pinchZoomEnabled"
export const UPDATER_ENABLED = app.isPackaged && CHANNEL !== "dev"
