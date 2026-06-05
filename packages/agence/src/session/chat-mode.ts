import path from "path"
import { Schema } from "effect"
import { Global } from "@agence-ai/core/global"
import { Wildcard } from "@agence-ai/core/util/wildcard"
import { Permission } from "@/permission"
import type { InstanceContext } from "@/project/instance-context"
import type { Session } from "./session"
import { plan as planPath } from "./session"
import type { MessageV2 } from "./message-v2"
import PROMPT_PLAN_CHAT from "./prompt/plan-chat-mode.txt"
import PROMPT_RESEARCH from "./prompt/research-mode.txt"
import PROMPT_WRITE_RESEARCH from "./prompt/write-research-addendum.txt"
import PROMPT_SEARCH_RESEARCH from "./prompt/search-research-addendum.txt"
import PROMPT_RESEARCH_STEP from "./prompt/research-step-reminder.txt"

export const Mode = Schema.Literals(["build", "plan", "research"]).annotate({ identifier: "ChatMode" })
export type Mode = Schema.Schema.Type<typeof Mode>

const RESEARCH_REPORT_GLOBS = [".agence/knowledge/wiki/research/*.md", ".agence/knowledge/reports/*.md"] as const

function researchContext(input: { session: Session.Info; ctx: InstanceContext }) {
  const reportDir = path.join(input.ctx.worktree, ".agence", "knowledge", "wiki", "research")
  const defaultReportPath = path.join(reportDir, `${new Date().toISOString().slice(0, 10)}-${input.session.slug}.md`)
  return {
    reportDir,
    defaultReportPath,
    reportGlobs: RESEARCH_REPORT_GLOBS.join(", "),
  }
}

function fillResearchTemplate(template: string, input: { session: Session.Info; ctx: InstanceContext }) {
  const { reportDir, defaultReportPath, reportGlobs } = researchContext(input)
  return template
    .replaceAll("${reportDir}", reportDir)
    .replaceAll("${defaultReportPath}", defaultReportPath)
    .replaceAll("${reportGlobs}", reportGlobs)
}

export function permissions(mode: Mode | undefined, input: { session: Session.Info; ctx: InstanceContext }) {
  if (!mode || mode === "build") return [] as Permission.Rule[]

  if (mode === "plan") {
    const planFile = planPath(input.session, input.ctx)
    const relPlan = path.relative(input.ctx.worktree, planFile)
    return Permission.fromConfig({
      bash: "deny",
      apply_patch: "deny",
      repo_clone: "deny",
      env_write: "deny",
      plugin_install: "deny",
      todowrite: "deny",
      edit: {
        "*": "deny",
        ".opencode/plans/*.md": "allow",
        [relPlan]: "allow",
        [path.relative(input.ctx.worktree, path.join(Global.Path.data, "plans", "*.md"))]: "allow",
      },
    })
  }

  return Permission.fromConfig({
    bash: "deny",
    apply_patch: "deny",
    repo_clone: "deny",
    env_write: "deny",
    plugin_install: "deny",
    todowrite: "deny",
    edit: {
      "*": "deny",
      ...Object.fromEntries(RESEARCH_REPORT_GLOBS.map((pattern) => [pattern, "allow"])),
    },
  })
}

export function syntheticReminder(mode: Mode | undefined, input: { session: Session.Info; ctx: InstanceContext }) {
  if (!mode || mode === "build") return undefined

  if (mode === "plan") {
    const planFile = planPath(input.session, input.ctx)
    return PROMPT_PLAN_CHAT.replaceAll("${planFile}", planFile).replaceAll(
      "${reportGlobs}",
      RESEARCH_REPORT_GLOBS.join(", "),
    )
  }

  return fillResearchTemplate(PROMPT_RESEARCH, input)
}

export function stepReminder(
  mode: Mode | undefined,
  input: { session: Session.Info; ctx: InstanceContext; messages: MessageV2.WithParts[]; userMessageID: string },
) {
  if (mode !== "research") return undefined
  if (researchReportWritten(input.messages, input.userMessageID, input.ctx.worktree)) return undefined
  return fillResearchTemplate(PROMPT_RESEARCH_STEP, input)
}

export function toolDescription(
  toolID: string,
  mode: Mode | undefined,
  input: { session: Session.Info; ctx: InstanceContext },
  base: string,
) {
  if (mode !== "research") return base
  if (toolID === "write") return `${base}${fillResearchTemplate(PROMPT_WRITE_RESEARCH, input)}`
  if (toolID === "search") return `${base}${fillResearchTemplate(PROMPT_SEARCH_RESEARCH, input)}`
  return base
}

export function researchReportWritten(messages: MessageV2.WithParts[], userMessageID: string, worktree: string) {
  const start = messages.findIndex((msg) => msg.info.id === userMessageID)
  if (start < 0) return false

  for (const msg of messages.slice(start)) {
    for (const part of msg.parts) {
      if (part.type !== "tool" || part.tool !== "write") continue
      if (part.state.status !== "completed") continue
      const filePath = part.state.input.filePath
      if (typeof filePath !== "string") continue
      const rel = path.isAbsolute(filePath) ? path.relative(worktree, filePath) : filePath
      const normalized = rel.replaceAll("\\", "/")
      if (RESEARCH_REPORT_GLOBS.some((pattern) => Wildcard.match(normalized, pattern))) return true
    }
  }

  return false
}

export * as ChatMode from "./chat-mode"
