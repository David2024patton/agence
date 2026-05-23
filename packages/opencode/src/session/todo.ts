import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import { SessionID } from "./schema"
import { Effect, Layer, Context, Schema } from "effect"
import { Database } from "@/storage/db"
import { eq, asc, or, like } from "drizzle-orm"
import { TodoTable, TaskHistoryTable } from "./session.sql"

export const Info = Schema.Struct({
  id: Schema.optional(Schema.String).annotate({ description: "Unique ID for referencing this task. Auto-generated if omitted." }),
  content: Schema.String.annotate({ description: "Brief description of the task" }),
  description: Schema.optional(Schema.String).annotate({ description: "Longer description, notes, or context for this task" }),
  status: Schema.String.annotate({
    description: "Current status of the task: pending, in_progress, completed, cancelled",
  }),
  priority: Schema.String.annotate({ description: "Priority level of the task: high, medium, low" }),
  parentId: Schema.optional(Schema.String).annotate({ description: "ID of the parent task if this is a subtask" }),
  dependsOn: Schema.optional(Schema.Array(Schema.String)).annotate({ description: "Task IDs that must be completed before this one can start" }),
  tags: Schema.optional(Schema.Array(Schema.String)).annotate({ description: "Labels for categorization: bug, feature, refactor, docs, test, etc." }),
}).annotate({ identifier: "Todo" })
export type Info = Schema.Schema.Type<typeof Info>

export const Event = {
  Updated: BusEvent.define(
    "todo.updated",
    Schema.Struct({
      sessionID: SessionID,
      todos: Schema.Array(Info),
    }),
  ),
}

export interface Interface {
  readonly update: (input: { sessionID: SessionID; todos: Info[] }) => Effect.Effect<void>
  readonly get: (sessionID: SessionID) => Effect.Effect<Info[]>
  readonly getAll: () => Effect.Effect<Info[]>
  readonly search: (query: string) => Effect.Effect<Info[]>
  readonly carry: (input: { fromSessionID: SessionID; toSessionID: SessionID; taskIds: string[] }) => Effect.Effect<Info[]>
  readonly history: (taskId: string) => Effect.Effect<{ field: string; oldValue?: string; newValue?: string; createdAt: number }[]>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/SessionTodo") {}

function id() {
  return Math.random().toString(36).slice(2, 10)
}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const bus = yield* Bus.Service

    const recordHistory = (sessionID: SessionID, prev: Record<string, string>, next: Record<string, string>, taskId: string, now: number) => {
      for (const [field, newVal] of Object.entries(next)) {
        const oldVal = prev[field]
        if (oldVal === newVal) continue
        if (oldVal === undefined && newVal === undefined) continue
        Database.use((db) =>
          db.insert(TaskHistoryTable).values({
            id: id(),
            task_id: taskId,
            session_id: sessionID,
            field,
            old_value: oldVal ?? null,
            new_value: newVal ?? null,
            time_created: now,
            time_updated: now,
          }).run(),
        )
      }
    }

    const update = Effect.fn("Todo.update")(function* (input: { sessionID: SessionID; todos: Info[] }) {
      yield* Effect.sync(() => {
        const now = Date.now()
        Database.transaction((db) => {
          const oldRows = db.select().from(TodoTable).where(eq(TodoTable.session_id, input.sessionID)).all()
          const oldMap = new Map(oldRows.map((r) => [r.id, r]))

          db.delete(TodoTable).where(eq(TodoTable.session_id, input.sessionID)).run()
          if (input.todos.length === 0) return
          db.insert(TodoTable)
            .values(
              input.todos.map((todo, position) => ({
                id: todo.id || id(),
                session_id: input.sessionID,
                content: todo.content,
                description: todo.description ?? null,
                status: todo.status,
                priority: todo.priority,
                parent_id: todo.parentId ?? null,
                depends_on: todo.dependsOn ? [...todo.dependsOn] : null,
                tags: todo.tags ? [...todo.tags] : null,
                position,
                time_created: now,
                time_updated: now,
              })),
            )
            .run()

          // Record history for status changes
          for (const todo of input.todos) {
            const tid = todo.id || ""
            const oldRow = tid ? oldMap.get(tid) : undefined
            recordHistory(input.sessionID, oldRow ? { status: oldRow.status, priority: oldRow.priority, content: oldRow.content } : {}, { status: todo.status, priority: todo.priority, content: todo.content }, tid, now)
          }
        })
      })
      yield* bus.publish(Event.Updated, input)
    })

    const rowToInfo = (row: typeof TodoTable.$inferSelect): Info => ({
      id: row.id,
      content: row.content,
      description: row.description ?? undefined,
      status: row.status,
      priority: row.priority,
      parentId: row.parent_id ?? undefined,
      dependsOn: row.depends_on ?? undefined,
      tags: row.tags ?? undefined,
    })

    const get = Effect.fn("Todo.get")(function* (sessionID: SessionID) {
      const rows = yield* Effect.sync(() =>
        Database.use((db) =>
          db.select().from(TodoTable).where(eq(TodoTable.session_id, sessionID)).orderBy(asc(TodoTable.position)).all(),
        ),
      )
      return rows.map(rowToInfo)
    })

    const getAll = Effect.fn("Todo.getAll")(function* () {
      const rows = yield* Effect.sync(() =>
        Database.use((db) =>
          db.select().from(TodoTable).orderBy(asc(TodoTable.session_id), asc(TodoTable.position)).all(),
        ),
      )
      return rows.map(rowToInfo)
    })

    const search = Effect.fn("Todo.search")(function* (query: string) {
      const pattern = `%${query}%`
      const rows = yield* Effect.sync(() =>
        Database.use((db) =>
          db.select().from(TodoTable)
            .where(or(like(TodoTable.content, pattern), like(TodoTable.description, pattern)))
            .orderBy(asc(TodoTable.time_created)).all(),
        ),
      )
      return rows.map(rowToInfo)
    })

    const carry = Effect.fn("Todo.carry")(function* (input: { fromSessionID: SessionID; toSessionID: SessionID; taskIds: string[] }) {
      const fromRows = yield* Effect.sync(() =>
        Database.use((db) =>
          db.select().from(TodoTable)
            .where(eq(TodoTable.session_id, input.fromSessionID)).orderBy(asc(TodoTable.position)).all(),
        ),
      )
      const toCarry = fromRows.filter((r) => input.taskIds.length === 0 || input.taskIds.includes(r.id))
      const existing = yield* Effect.sync(() =>
        Database.use((db) =>
          db.select().from(TodoTable).where(eq(TodoTable.session_id, input.toSessionID)).all(),
        ),
      )
      const maxPos = existing.reduce((max, r) => Math.max(max, r.position), -1)
      const now = Date.now()

      yield* Effect.sync(() =>
        Database.transaction((db) => {
          for (let i = 0; i < toCarry.length; i++) {
            const t = toCarry[i]
            db.insert(TodoTable).values({
              id: t.id + (existing.some((e) => e.id === t.id) ? "_c" : ""),
              session_id: input.toSessionID,
              content: t.content + " (carried forward)",
              description: t.description,
              status: "pending",
              priority: t.priority,
              parent_id: t.parent_id,
              depends_on: t.depends_on,
              tags: t.tags,
              position: maxPos + 1 + i,
              time_created: now,
              time_updated: now,
            }).onConflictDoNothing().run()
          }
        }),
      )

      const result = yield* get(input.toSessionID)
      return result.filter((t) => t.content?.includes("(carried forward)"))
    })

    const history = Effect.fn("Todo.history")(function* (taskId: string) {
      const rows = yield* Effect.sync(() =>
        Database.use((db) =>
          db.select().from(TaskHistoryTable)
            .where(eq(TaskHistoryTable.task_id, taskId))
            .orderBy(asc(TaskHistoryTable.time_created)).all(),
        ),
      )
      return rows.map((r) => ({
        field: r.field,
        oldValue: r.old_value ?? undefined,
        newValue: r.new_value ?? undefined,
        createdAt: r.time_created,
      }))
    })

    return Service.of({ update, get, getAll, search, carry, history })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Bus.layer))

export * as Todo from "./todo"
