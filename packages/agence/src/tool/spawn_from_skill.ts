import path from "path"
import { Effect, Schema } from "effect"
import { InstanceState } from "@/effect/instance-state"
import { AppFileSystem } from "@agence-ai/core/filesystem"
import * as Tool from "./tool"

// ═══ spawn_from_skill ════════════════════════════════════════════════════════
// Coding Agent → Runtime Agent bridge.
//
// Reads a SKILL.md file (by name or path), extracts its frontmatter metadata,
// and sets up a task invocation with that skill pre-loaded as the persona so
// the resulting subagent is domain-aware from the start.

export const SpawnFromSkillParameters = Schema.Struct({
  skill: Schema.String.annotate({
    description:
      'Name of the skill to spawn from (e.g. "golang-pro") or an absolute/relative path to a SKILL.md file',
  }),
  prompt: Schema.String.annotate({
    description: "The task prompt to give the spawned subagent",
  }),
  agent_type: Schema.optional(Schema.String).annotate({
    description: "Subagent type to use (default: build). Must match an agent defined in .agence/agents/",
  }),
})

export const SpawnFromSkillTool = Tool.define<typeof SpawnFromSkillParameters, { skillName: string }, AppFileSystem.Service>(
  "spawn_from_skill",
  Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    return {
      description:
        "Spawn a subagent pre-loaded with a SKILL.md as its persona/context. The Coding Agent reads a skill definition and the Runtime Agent inherits its domain knowledge. Use after reflect or when a skill exists that exactly matches the task domain.",
      parameters: SpawnFromSkillParameters,
      execute: (
        params: { skill: string; prompt: string; agent_type?: string },
        _ctx: Tool.Context,
      ) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context

          // Resolve skill path — either by name (search .agence/skills/, skills/, installs) or direct path
          const skillPath = yield* resolveSkillPath(fs, instance.directory, params.skill)

          if (!skillPath) {
            return {
              title: "spawn_from_skill",
              metadata: { skillName: params.skill },
              output: [
                `❌ Skill not found: "${params.skill}"`,
                "",
                "Searched locations:",
                `  ${path.join(instance.directory, ".agence", "skills", params.skill, "SKILL.md")}`,
                `  ${path.join(instance.directory, "skills", params.skill, "SKILL.md")}`,
                `  ${path.join(instance.directory, ".agence", "installs", params.skill, "SKILL.md")}`,
                "",
                "Run `reflect` to generate a skill from this session, then spawn from it.",
              ].join("\n"),
            }
          }

          const skillContent = yield* fs.readFileString(skillPath).pipe(
            Effect.catch(() => Effect.succeed("")),
          )

          // Extract name from frontmatter for display
          const nameMatch = skillContent.match(/^name:\s*(.+)$/m)
          const descMatch = skillContent.match(/^description:\s*(.+)$/m)
          const skillName = nameMatch?.[1]?.trim() ?? params.skill
          const skillDesc = descMatch?.[1]?.trim()

          const agentType = params.agent_type ?? "build"

          // Build the enriched prompt — skill content is injected as context
          // so the subagent starts domain-aware without needing the skill tool
          const enrichedPrompt = [
            `<skill_context name="${skillName}">`,
            skillContent.trim(),
            "</skill_context>",
            "",
            params.prompt,
          ].join("\n")

          // Write a lightweight session config so the spawned task picks up the skill
          const spawnConfig = {
            skillName,
            skillPath,
            skillDesc,
            agentType,
            prompt: params.prompt,
            spawnedAt: new Date().toISOString(),
          }
          const spawnLogPath = path.join(instance.directory, ".agence", "spawns", `${Date.now()}-${skillName}.json`)
          yield* fs.writeWithDirs(spawnLogPath, JSON.stringify(spawnConfig, null, 2)).pipe(Effect.ignore)

          return {
            title: `Spawn: ${skillName}`,
            metadata: { skillName },
            output: [
              `## Spawning subagent from skill: ${skillName}`,
              skillDesc ? `Skill: ${skillDesc}` : "",
              `Agent type: ${agentType}`,
              `Skill file: ${skillPath}`,
              "",
              "The skill context has been injected into the prompt below.",
              "To dispatch the subagent, call the `task` tool with:",
              "",
              "```",
              `subagent_type: ${agentType}`,
              `prompt: (enriched — skill context prepended)`,
              "```",
              "",
              "Enriched prompt ready for task tool:",
              "---",
              enrichedPrompt.slice(0, 600) + (enrichedPrompt.length > 600 ? "\n... (truncated)" : ""),
            ]
              .filter((line) => line !== null)
              .join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)

const resolveSkillPath = (fs: AppFileSystem.Interface, directory: string, skill: string) =>
  Effect.gen(function* () {
    // If it looks like an explicit path, try it directly
    if (skill.includes("/") || skill.includes("\\") || skill.endsWith(".md")) {
      const abs = path.isAbsolute(skill) ? skill : path.resolve(directory, skill)
      if (yield* fs.existsSafe(abs)) return abs
      return undefined
    }

    // Search by name in priority order
    const candidates = [
      path.join(directory, ".agence", "skills", skill, "SKILL.md"),
      path.join(directory, "skills", skill, "SKILL.md"),
      path.join(directory, ".agence", "installs", skill, "SKILL.md"),
      path.join(directory, ".agence", "skills", "best", `${skill}.md`),
    ]

    for (const candidate of candidates) {
      if (yield* fs.existsSafe(candidate)) return candidate
    }

    return undefined
  })
