export function isPtyNotFoundError(error: unknown) {
  if (!error) return false
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: unknown }).status
    if (status === 404) return true
  }
  const message = error instanceof Error ? error.message : String(error)
  return message.includes("PTY session not found") || message.includes("PtyNotFound")
}
