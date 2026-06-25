/**
 * Prompt-injection tool calling for local models that lack native tool-call support.
 *
 * When a model has `capabilities.toolcall === false`, Agence injects all available
 * tool definitions directly into the system prompt as an XML schema block. The model
 * is then expected to emit tool invocations as XML in its text response. This module
 * provides:
 *
 *   1. `buildToolSystemPrompt(tools)` — formats tool schemas for the system prompt.
 *   2. `parseToolCalls(text)` — parses XML tool invocations from the model's reply.
 *   3. `stripToolCalls(text)` — removes tool-call XML from text before display.
 */

import type { Tool } from "ai"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ParsedToolCall = {
  id: string
  name: string
  args: Record<string, unknown>
  raw: string // original XML fragment
}

// ---------------------------------------------------------------------------
// System-prompt injection
// ---------------------------------------------------------------------------

/**
 * Generates the tool-calling system prompt block that gets appended to the
 * main system prompt when the model does not support native tool calling.
 */
export function buildToolSystemPrompt(tools: Record<string, Tool>): string {
  const entries = Object.entries(tools).filter(([name]) => name !== "invalid")
  if (entries.length === 0) return ""

  const schemas = entries
    .map(([name, tool]) => {
      const params = toolParameters(tool)
      const desc = (tool as any).description ?? ""
      const paramLines = params
        .map((p) => `    <param name="${p.name}" type="${p.type}" required="${p.required}">${p.description}</param>`)
        .join("\n")
      return [
        `  <tool name="${name}">`,
        `    <description>${desc}</description>`,
        paramLines ? `    <parameters>\n${paramLines}\n    </parameters>` : "    <parameters/>",
        `  </tool>`,
      ].join("\n")
    })
    .join("\n")

  return [
    "## Tool Calling",
    "",
    "You have access to the following tools. To use a tool, emit a `<tool_call>` block in your response.",
    "The block must appear on its own line(s) and use this exact format:",
    "",
    "```",
    '<tool_call name="TOOL_NAME">',
    '  <arg name="PARAM">VALUE</arg>',
    "</tool_call>",
    "```",
    "",
    "Rules:",
    "- Only call tools when necessary to answer the user.",
    "- You may call multiple tools sequentially.",
    "- After a tool result is provided, continue your response normally.",
    "- Never fabricate tool results.",
    "",
    "<available_tools>",
    schemas,
    "</available_tools>",
  ].join("\n")
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

// Matches <tool_call name="...">...</tool_call> across multiple lines.
const TOOL_CALL_RE = /<tool_call\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/tool_call>/g

/**
 * Parses tool invocation XML from a model's text response.
 * Returns an array of parsed tool calls in the order they appear.
 */
export function parseToolCalls(text: string): ParsedToolCall[] {
  const results: ParsedToolCall[] = []
  let match: RegExpExecArray | null
  TOOL_CALL_RE.lastIndex = 0

  while ((match = TOOL_CALL_RE.exec(text)) !== null) {
    const [raw, name, body] = match
    const args = parseArgs(body)
    results.push({
      id: `ptc_${Date.now()}_${results.length}`,
      name,
      args,
      raw,
    })
  }

  return results
}

/**
 * Removes all <tool_call> XML blocks from text before displaying to the user.
 */
export function stripToolCalls(text: string): string {
  return text.replace(TOOL_CALL_RE, "").replace(/\n{3,}/g, "\n\n").trim()
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseArgs(body: string): Record<string, unknown> {
  const args: Record<string, unknown> = {}
  const argRe = /<arg\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/arg>/g
  let m: RegExpExecArray | null
  while ((m = argRe.exec(body)) !== null) {
    const [, key, raw] = m
    args[key] = coerceValue(raw.trim())
  }
  return args
}

function coerceValue(raw: string): unknown {
  if (raw === "true") return true
  if (raw === "false") return false
  if (raw === "null") return null
  const n = Number(raw)
  if (!Number.isNaN(n) && raw !== "") return n
  // Try JSON parse for arrays/objects
  if ((raw.startsWith("{") && raw.endsWith("}")) || (raw.startsWith("[") && raw.endsWith("]"))) {
    try {
      return JSON.parse(raw)
    } catch {
      // fall through
    }
  }
  return raw
}

type ParamDef = {
  name: string
  type: string
  required: boolean
  description: string
}

function toolParameters(tool: Tool): ParamDef[] {
  const schema = (tool as any).inputSchema ?? (tool as any).parameters
  if (!schema?.properties) return []
  const required: string[] = schema.required ?? []
  return Object.entries(schema.properties as Record<string, any>).map(([name, prop]) => ({
    name,
    type: prop.type ?? "string",
    required: required.includes(name),
    description: prop.description ?? "",
  }))
}
