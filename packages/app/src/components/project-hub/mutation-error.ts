import { showToast } from "@agence-ai/ui/toast"

export function showHubMutationError(title: string, error: unknown) {
  showToast({
    variant: "error",
    title,
    description: error instanceof Error ? error.message : String(error),
  })
}
