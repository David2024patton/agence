import path from "path"
import { AppFileSystem } from "@agence-ai/core/filesystem"
import { Effect, Schema } from "effect"
import { Database } from "@/storage/db"
import { ProjectTable } from "./project.sql"
import { SessionTable } from "../session/session.sql"
import { WorkspaceTable } from "../control-plane/workspace.sql"
import { eq } from "drizzle-orm"
import { tryRemapDriveLetter } from "./projects-index"

export class NotAgenceProjectError extends Schema.TaggedErrorClass<NotAgenceProjectError>()("NotAgenceProjectError", {
  message: Schema.String,
  directory: Schema.optional(Schema.String),
}) {}

export function assertProjectDirectory(directory: string) {
  return Effect.gen(function* () {
    const trimmed = directory.trim()
    if (!trimmed) {
      return yield* Effect.fail(
        new NotAgenceProjectError({
          message: "Open a project in Agence before using the agent, skills, MCPs, or personas.",
        }),
      )
    }

    const fs = yield* AppFileSystem.Service
    const normalized = path.resolve(trimmed)
    let exists = yield* fs.existsSafe(normalized)
    let finalDir = normalized

    if (!exists) {
      const remapped = tryRemapDriveLetter(normalized)
      if (remapped) {
        finalDir = remapped
        exists = true
        // Remap in database!
        yield* Effect.sync(() =>
          Database.transaction((d) => {
            const allProjects = d.select().from(ProjectTable).all()
            const matchPath = (p1: string, p2: string) => {
              const n1 = path.resolve(p1).toLowerCase().replace(/\\/g, "/")
              const n2 = path.resolve(p2).toLowerCase().replace(/\\/g, "/")
              return n1 === n2
            }
            const matchingProjects = allProjects.filter((p) => matchPath(p.worktree, normalized))
            for (const proj of matchingProjects) {
              d.update(ProjectTable)
                .set({ worktree: remapped })
                .where(eq(ProjectTable.id, proj.id))
                .run()
              d.update(SessionTable)
                .set({ directory: remapped })
                .where(eq(SessionTable.project_id, proj.id))
                .run()
              d.update(WorkspaceTable)
                .set({ directory: remapped })
                .where(eq(WorkspaceTable.project_id, proj.id))
                .run()
            }
          })
        )
        // Also update projects-index.json
        const { registerProject } = yield* Effect.promise(() => import("./projects-index"))
        yield* registerProject(remapped)
      }
    }

    if (!exists) {
      // Detached / missing directory failsafe:
      // Only allow loading to proceed if the project or session is already known in the database.
      const isKnown = yield* Effect.sync(() => {
        const matchPath = (p1: string, p2: string) => {
          const n1 = path.resolve(p1).toLowerCase().replace(/\\/g, "/")
          const n2 = path.resolve(p2).toLowerCase().replace(/\\/g, "/")
          return n1 === n2
        }
        const proj = Database.use((d) => d.select().from(ProjectTable).all()).some((p) => matchPath(p.worktree, finalDir))
        if (proj) return true
        return Database.use((d) => d.select().from(SessionTable).all()).some((s) => matchPath(s.directory, finalDir))
      })
      if (!isKnown) {
        return yield* Effect.fail(
          new NotAgenceProjectError({
            message: "Project directory not found.",
            directory: finalDir,
          }),
        )
      }
      return finalDir
    }

    const agenceDir = path.join(finalDir, ".agence")
    if (!(yield* fs.existsSafe(agenceDir))) {
      const { ensureHubBundle } = yield* Effect.promise(() => import("./hub-bootstrap"))
      yield* ensureHubBundle(finalDir)
    }

    return finalDir
  })
}
