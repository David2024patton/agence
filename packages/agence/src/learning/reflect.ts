import { Effect } from "effect"
import { generateText } from "ai"
import { Session } from "@/session/session"
import { Provider } from "@/provider/provider"
import { InstanceState } from "@/effect/instance-state"
import { storeLearning } from "./index"
import { SessionID } from "@/session/schema"
import fs from "fs/promises"
import path from "path"

export function reflectAndLearn(sessionID: SessionID) {
  return Effect.gen(function* () {
    const session = yield* Session.Service
    const provider = yield* Provider.Service
    const ctx = yield* InstanceState.context

    const messages = yield* session.messages({ sessionID }).pipe(Effect.catch(() => Effect.succeed([] as any[])))
    if (messages.length < 2) return

    const lastMsgs = messages.slice(-6)
    const historyText = lastMsgs
      .map((m: any) => {
        const role = m.info.role
        const partsText = m.parts
          .filter((p: any) => p.type === "text")
          .map((p: any) => p.text ?? p.value ?? "")
          .join("\n")
        return `${role.toUpperCase()}: ${partsText}`
      })
      .join("\n\n")

    const lastAssistantMessage = messages.findLast((m: any) => m.info.role === "assistant")
    const model = lastAssistantMessage?.info.model
    if (!model) return

    const language = yield* provider.getLanguage(model).pipe(Effect.catch(() => Effect.succeed(undefined)))
    if (!language) return

    // Discover and load existing procedural skills from the workspace skills/ directory
    const skillsDir = path.join(ctx.directory, "skills")
    const existingSkills: { name: string; content: string }[] = []

    yield* Effect.promise(async () => {
      try {
        const entries = await fs.readdir(skillsDir, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.isDirectory() && entry.name.startsWith("agence-")) {
            const skillPath = path.join(skillsDir, entry.name, "SKILL.md")
            try {
              const content = await fs.readFile(skillPath, "utf-8")
              existingSkills.push({ name: entry.name, content })
            } catch {}
          }
        }
      } catch {}
    })

    const existingSkillsText = existingSkills.length > 0
      ? `\n\nExisting Skills in Workspace:\n${existingSkills.map((s) => `Skill name: "${s.name}"\nContent:\n${s.content}\n---\n`).join("\n")}\nIf your reflection shows that one of these existing skills needs refinement (such as adding new troubleshooting notes, fixing command paths, or updating steps based on recent failures/corrections in the conversation history), you should return the updated and consolidated skill content under the SAME name to overwrite and refine it, rather than creating a new one.`
      : ""

    const systemPrompt = `You are a background cognitive consolidation daemon for Agence, an agentic coding framework.
Analyze the recent conversation between the user and the assistant.
Extract two types of crystallized knowledge to prevent repeating mistakes or re-learning processes:

1. "learnings": Lightweight technical rules, database column preferences, workflow conventions, or user preferences to save as persistent semantic memories in Agence.
2. "skills": Complete, standalone, repeatable step-by-step procedures or architectural standards that should be saved as formal reusable skills.

Format the output strictly as a JSON object with this exact structure (no markdown wrappers, backticks, or explanations):
{
  "learnings": [
    {
      "concept": "Drizzle snake_case preference",
      "description": "Always define column names as snake_case in drizzle tables so they map natively to DB columns without explicit string mappings.",
      "confidence": "high"
    }
  ],
  "skills": [
    {
      "name": "compile-node-pty",
      "description": "Procedural walkthrough for rebuilding the native node-pty dependency under Windows and Bun.",
      "content": "---\\nname: agence-compile-node-pty\\ndescription: Procedural walkthrough for rebuilding the native node-pty dependency under Windows and Bun.\\n---\\n\\n# Rebuilding node-pty under Windows\\n\\nFollow these steps:\\n1. Run ...\\n2. Execute ..."
    }
  ]
}`

    yield* Effect.logInfo(`[Agence Memory] Reflecting on session ${sessionID} to crystallize lessons & procedural skills...`)

    const result = yield* Effect.promise(() =>
      generateText({
        model: language,
        system: systemPrompt,
        prompt: `Recent conversation history:\n\n${historyText}${existingSkillsText}`,
      }),
    ).pipe(Effect.catch(() => Effect.succeed(undefined)))

    if (!result || !result.text) return

    const text = result.text.trim()
    let parsed: { learnings?: any[]; skills?: any[] } = {}
    try {
      const jsonStr = text.replace(/^```json\s*/i, "").replace(/```$/, "").trim()
      parsed = JSON.parse(jsonStr)
    } catch {
      return
    }

    const { runMemoryMaintenance } = yield* Effect.promise(() => import("./memory-intelligence"))

    // 1. Process conversational semantic learnings (Database storage)
    if (Array.isArray(parsed.learnings)) {
      for (const item of parsed.learnings) {
        if (item.concept && item.description) {
          const layer =
            /prefer|always|never|style/i.test(item.description) ? "preference"
            : /error|fix|avoid|mistake/i.test(item.description) ? "experience"
            : /user|david|team|role/i.test(item.description) ? "identity"
            : "context"
          yield* storeLearning({
            projectId: ctx.project.id,
            source: layer,
            concept: item.concept,
            description: item.description,
            confidence: item.confidence || "high",
            metadata: { layer, importance: item.confidence === "high" ? "high" : "medium", autoCapture: false },
          }).pipe(Effect.catch(() => Effect.succeed(undefined)))
          yield* Effect.logInfo(`[Agence Memory] Successfully crystallized database learning: "${item.concept}"`)
        }
      }
    }

    yield* runMemoryMaintenance(ctx.project.id).pipe(Effect.catch(() => Effect.void))

    // 2. Process procedural skill creation & refinement (Markdown file creation/refinement)
    if (Array.isArray(parsed.skills)) {
      for (const skill of parsed.skills) {
        if (skill.name && skill.description && skill.content) {
          const prefix = skill.name.startsWith("agence-") ? "" : "agence-"
          const sanitizedName = `${prefix}${skill.name.toLowerCase().replace(/[^a-z0-9_-]/g, "-")}`
          const skillDir = path.join(ctx.directory, "skills", sanitizedName)
          const skillFilePath = path.join(skillDir, "SKILL.md")

          const fileExists = existingSkills.some((s) => s.name === sanitizedName)

          yield* Effect.promise(async () => {
            try {
              await fs.mkdir(skillDir, { recursive: true })
              await fs.writeFile(skillFilePath, skill.content.trim(), "utf-8")
            } catch (e) {
              console.error(`[Agence Memory] Failed to write skill file for ${sanitizedName}:`, e)
            }
          })

          if (fileExists) {
            yield* Effect.logInfo(`[Agence Memory] Successfully refined existing procedural skill: "skills/${sanitizedName}/SKILL.md"`)
          } else {
            yield* Effect.logInfo(`[Agence Memory] Successfully created autonomous procedural skill file: "skills/${sanitizedName}/SKILL.md"`)
          }
        }
      }
    }
  })
}
