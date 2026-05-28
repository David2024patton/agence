const TAG_RULES: { tag: string; pattern: RegExp }[] = [
  { tag: "UI", pattern: /\b(ui|ux|css|tailwind|react|solid|component|frontend|layout|theme)\b/i },
  { tag: "workflow", pattern: /\b(workflow|process|pipeline|deploy|ci|cd|release)\b/i },
  { tag: "tools", pattern: /\b(tool|mcp|shell|terminal|command|script)\b/i },
  { tag: "testing", pattern: /\b(test|spec|bun test|vitest|jest|coverage)\b/i },
  { tag: "architecture", pattern: /\b(architect|pattern|refactor|module|layer|service)\b/i },
  { tag: "database", pattern: /\b(sql|drizzle|sqlite|postgres|migration|schema)\b/i },
  { tag: "api", pattern: /\b(api|endpoint|http|rest|graphql|route)\b/i },
  { tag: "auth", pattern: /\b(auth|login|token|permission|credential|secret)\b/i },
  { tag: "performance", pattern: /\b(perf|latency|cache|optimi[sz]e|slow|memory leak)\b/i },
  { tag: "docs", pattern: /\b(doc|readme|comment|markdown)\b/i },
]

const LAYER_TAGS: Record<string, string[]> = {
  preference: ["preference"],
  identity: ["identity"],
  experience: ["lesson"],
  activity: ["event"],
  context: ["context"],
}

const REASON_TAGS: Record<string, string[]> = {
  user_preference: ["preference"],
  user_correction: ["correction"],
  tool_failure: ["tools", "error"],
  tool_failure_lesson: ["tools", "lesson"],
}

export function inferMemoryTags(input: {
  layer?: string
  concept?: string
  description: string
  reason?: string
}): string[] {
  const text = `${input.concept ?? ""} ${input.description}`.trim()
  const tags = new Set<string>()

  if (input.layer && LAYER_TAGS[input.layer]) {
    for (const t of LAYER_TAGS[input.layer]) tags.add(t)
  }
  if (input.reason && REASON_TAGS[input.reason]) {
    for (const t of REASON_TAGS[input.reason]) tags.add(t)
  }
  for (const { tag, pattern } of TAG_RULES) {
    if (pattern.test(text)) tags.add(tag)
  }

  return [...tags].slice(0, 12)
}

export function mergeMemoryTags(
  explicit: string[] | undefined,
  inferred: string[],
): string[] {
  const out = new Set<string>()
  for (const t of explicit ?? []) {
    const n = t.trim()
    if (n) out.add(n)
  }
  for (const t of inferred) out.add(t)
  return [...out].slice(0, 16)
}

export function tagMatchBoost(query: string, tags: string[] | undefined): number {
  if (!tags?.length) return 1
  const q = query.toLowerCase()
  const tokens = q.split(/\s+/).filter((t) => t.length > 2)
  let hits = 0
  for (const tag of tags) {
    const t = tag.toLowerCase()
    if (q.includes(t)) hits += 2
    if (tokens.some((tok) => t.includes(tok) || tok.includes(t))) hits += 1
  }
  if (hits === 0) return 1
  return 1 + Math.min(hits * 0.08, 0.35)
}
