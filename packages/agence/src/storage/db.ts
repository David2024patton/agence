import { type SQLiteTransaction } from "drizzle-orm/sqlite-core"
export * from "drizzle-orm"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { LocalContext } from "@/util/local-context"
import { Global } from "@agence-ai/core/global"
import * as Log from "@agence-ai/core/util/log"
import { NamedError } from "@agence-ai/core/util/error"
import path from "path"
import { readFileSync, readdirSync, existsSync } from "fs"
import { fileURLToPath } from "node:url"
import { Flag } from "@agence-ai/core/flag/flag"
import { InstallationChannel } from "@agence-ai/core/installation/version"
import { EffectBridge } from "@/effect/bridge"
import { init, applyMigrations } from "#db"
import { Effect, Schema } from "effect"

declare const AGENCE_MIGRATIONS: { sql: string; timestamp: number; name: string }[] | undefined

export const NotFoundError = NamedError.create("NotFoundError", {
  message: Schema.String,
})

const log = Log.create({ service: "db" })

type DatabaseFlags = Pick<RuntimeFlags.Info, "disableChannelDb" | "skipMigrations">

const readRuntimeFlags = () =>
  Effect.runSync(RuntimeFlags.Service.useSync((flags) => flags).pipe(Effect.provide(RuntimeFlags.defaultLayer)))

export function getChannelPath(flags: Pick<DatabaseFlags, "disableChannelDb"> = readRuntimeFlags()) {
  if (["latest", "beta", "prod"].includes(InstallationChannel) || flags.disableChannelDb)
    return path.join(Global.Path.data, "agence.db")
  if (["dev", "main", "local"].includes(InstallationChannel))
    return path.join(Global.Path.data, "agence-local.db")
  const safe = InstallationChannel.replace(/[^a-zA-Z0-9._-]/g, "-")
  return path.join(Global.Path.data, `agence-${safe}.db`)
}

export const getPath = (flags?: Pick<DatabaseFlags, "disableChannelDb">) => {
  if (Flag.AGENCE_DB) {
    if (Flag.AGENCE_DB === ":memory:" || path.isAbsolute(Flag.AGENCE_DB)) return Flag.AGENCE_DB
    return path.join(Global.Path.data, Flag.AGENCE_DB)
  }
  return getChannelPath(flags)
}

export type Transaction = SQLiteTransaction<"sync", void>

type Client = ReturnType<typeof init>

type Journal = { sql: string; timestamp: number; name: string }[]


function time(tag: string) {
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(tag)
  if (!match) return 0
  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
  )
}

function migrations(dir: string): Journal {
  try {
    const dirs = readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)

    const sql = dirs
      .map((name) => {
        const file = path.join(dir, name, "migration.sql")
        if (!existsSync(file)) return
        try {
          return {
            sql: readFileSync(file, "utf-8"),
            timestamp: time(name),
            name,
          }
        } catch { return undefined }
      })
      .filter(Boolean) as Journal

    return sql.sort((a, b) => a.timestamp - b.timestamp)
  } catch {
    log.warn("failed to load migrations", { dir })
    return []
  }
}

let client: Client | undefined
let loaded = false

export const Client = Object.assign(
  (flags: DatabaseFlags = readRuntimeFlags()): Client => {
    if (loaded) return client as Client

    const dbPath = getPath(flags)
    log.info("opening database", { path: dbPath })

    const db = init(dbPath)

    db.run("PRAGMA journal_mode = WAL")
    db.run("PRAGMA synchronous = NORMAL")
    db.run("PRAGMA busy_timeout = 5000")
    db.run("PRAGMA cache_size = -64000")
    db.run("PRAGMA foreign_keys = ON")
    db.run("PRAGMA wal_checkpoint(PASSIVE)")

    // Apply schema migrations
    const dirname =
      (typeof import.meta !== "undefined" && import.meta.dirname) ||
      (typeof __dirname !== "undefined" ? __dirname : "") ||
      (() => {
        try {
          return path.dirname(fileURLToPath(import.meta.url))
        } catch {
          return ""
        }
      })()
    const entries =
      typeof AGENCE_MIGRATIONS !== "undefined"
        ? AGENCE_MIGRATIONS
        : migrations(path.join(dirname, "../../migration"))
    if (entries.length > 0) {
      log.info("applying migrations", {
        count: entries.length,
        mode: typeof AGENCE_MIGRATIONS !== "undefined" ? "bundled" : "dev",
      })
      if (flags.skipMigrations) {
        for (const item of entries) {
          item.sql = "select 1;"
        }
      }
      applyMigrations(db, entries)
    }

    client = db
    loaded = true
    return db
  },
  {
    reset: () => {
      loaded = false
      client = undefined
    },
    loaded: () => loaded,
  },
)

export function close() {
  if (!Client.loaded()) return
  Client().$client.close()
  Client.reset()
}

export type TxOrDb = Transaction | Client

const ctx = LocalContext.create<{
  tx: TxOrDb
  effects: (() => void | Promise<void>)[]
}>("database")

export function use<T>(callback: (trx: TxOrDb) => T): T {
  try {
    return callback(ctx.use().tx)
  } catch (err) {
    if (err instanceof LocalContext.NotFound) {
      const effects: (() => void | Promise<void>)[] = []
      const result = ctx.provide({ effects, tx: Client() }, () => callback(Client()))
      for (const effect of effects) effect()
      return result
    }
    throw err
  }
}

export function effect(fn: () => any | Promise<any>) {
  const bound = EffectBridge.bind(fn)
  try {
    ctx.use().effects.push(bound)
  } catch {
    bound()
  }
}

type NotPromise<T> = T extends Promise<any> ? never : T

export function transaction<T>(
  callback: (tx: TxOrDb) => NotPromise<T>,
  options?: {
    behavior?: "deferred" | "immediate" | "exclusive"
  },
): NotPromise<T> {
  try {
    return callback(ctx.use().tx)
  } catch (err) {
    if (err instanceof LocalContext.NotFound) {
      const effects: (() => void | Promise<void>)[] = []
      const txCallback = EffectBridge.bind((tx: TxOrDb) => ctx.provide({ tx, effects }, () => callback(tx)))
      const result = Client().transaction(txCallback, { behavior: options?.behavior })
      for (const effect of effects) effect()
      return result as NotPromise<T>
    }
    throw err
  }
}

export * as Database from "./db"
