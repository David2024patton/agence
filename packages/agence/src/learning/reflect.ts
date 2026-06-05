import { Effect } from "effect"
import { generateText } from "ai"
import { Session } from "@/session/session"
import { Provider } from "@/provider/provider"
import { InstanceState } from "@/effect/instance-state"
import { storeLearning } from "./index"
import { SessionID } from "@/session/schema"

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

    const systemPrompt = `You are a background cognitive consolidation daemon for Agence, an agentic coding framework.
Analyze the recent conversation between the user and the assistant.
Extract lightweight technical rules, database column preferences, workflow conventions, or user preferences to save as persistent semantic memories in Agence.

Procedural skills are optimized separately by SkillOpt after each session.

Format the output strictly as a JSON object with this exact structure (no markdown wrappers, backticks, or explanations):
{
  "learnings": [
    {
      "concept": "Drizzle snake_case preference",
      "description": "Always define column names as snake_case in drizzle tables so they map natively to DB columns without explicit string mappings.",
      "confidence": "high"
    }
  ]
}`

    yield* Effect.logInfo(`[Agence Memory] Reflecting on session ${sessionID} to crystallize learnings...`)

    const result = yield* Effect.promise(() =>
      generateText({
        model: language,
        system: systemPrompt,
        prompt: `Recent conversation history:\n\n${historyText}`,
      }),
    ).pipe(Effect.catch(() => Effect.succeed(undefined)))

    if (!result || !result.text) return

    const text = result.text.trim()
    let parsed: { learnings?: { concept?: string; description?: string; confidence?: string }[] } = {}
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
  })
}
