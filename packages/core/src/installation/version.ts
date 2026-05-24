declare global {
  const AGENCE_VERSION: string
  const AGENCE_CHANNEL: string
}

export const InstallationVersion = typeof AGENCE_VERSION === "string" ? AGENCE_VERSION : "local"
export const InstallationChannel = typeof AGENCE_CHANNEL === "string" ? AGENCE_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"
