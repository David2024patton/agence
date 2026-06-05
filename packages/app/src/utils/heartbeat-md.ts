const lineRegex = /-\s*\[\s*([xX ])\s*\]\s*[eE]very\s+(\d+[mhd]):\s*([a-zA-Z0-9_-]+)\s*\|\s*(.+)$/i

export type HeartbeatTaskRow = {
  enabled: boolean
  interval: string
  intervalMs: number
  taskName: string
  prompt: string
  lastRun?: number
  nextRunInMs?: number
}

export function parseIntervalMs(str: string) {
  const num = parseInt(str, 10)
  const unit = str.slice(-1).toLowerCase()
  if (unit === "m") return num * 60 * 1000
  if (unit === "h") return num * 60 * 60 * 1000
  if (unit === "d") return num * 24 * 60 * 60 * 1000
  return num * 1000
}

export function parseHeartbeatTasks(content: string): HeartbeatTaskRow[] {
  const tasks: HeartbeatTaskRow[] = []
  for (const line of content.split("\n")) {
    const match = line.match(lineRegex)
    if (!match) continue
    const enabled = match[1].trim().toLowerCase() !== "x"
    const interval = match[2]
    tasks.push({
      enabled,
      interval,
      intervalMs: parseIntervalMs(interval),
      taskName: match[3],
      prompt: match[4].trim(),
    })
  }
  return tasks
}

export function enrichHeartbeatTasks(
  tasks: ReturnType<typeof parseHeartbeatTasks>,
  runs: Record<string, number>,
  now = Date.now(),
) {
  return tasks.map((task) => {
    const lastRun = runs[task.taskName]
    const nextRunInMs = lastRun === undefined ? 0 : Math.max(0, task.intervalMs - (now - lastRun))
    return { ...task, lastRun, nextRunInMs }
  })
}
