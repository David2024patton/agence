import * as Log from "@agence-ai/core/util/log"
import { Bus } from "@/bus"
import { InstallationVersion, InstallationChannel } from "@agence-ai/core/installation/version"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Effect, Stream } from "effect"
import * as Sse from "effect/unstable/encoding/Sse"
import { HttpServerResponse } from "effect/unstable/http"
import { InstanceHttpApi } from "../api"

const log = Log.create({ service: "monitor" })

type BusEvent = { id: string; type: string; properties: Record<string, unknown> }

function monitorEventData(data: unknown): Sse.Event {
  return {
    _tag: "Event",
    event: "monitor",
    id: undefined,
    data: JSON.stringify(data),
  }
}

export const monitorHandlers = HttpApiBuilder.group(InstanceHttpApi, "monitor", (handlers) =>
  Effect.gen(function* () {
    const bus = yield* Bus.Service
    const startedAt = Date.now()

    const recent: BusEvent[] = []
    const errors: BusEvent[] = []
    const commands: BusEvent[] = []
    const sessionStatuses: Record<string, string> = {}
    let commandCount = 0
    const MAX_EVENTS = 100

    yield* bus.subscribeAllCallback((evt: BusEvent) => {
      recent.push(evt)
      if (recent.length > MAX_EVENTS) recent.shift()
      if (evt.type === "command.executed") {
        commandCount++
        commands.push(evt)
        if (commands.length > 50) commands.shift()
      }
      if (evt.type === "session.error" || evt.properties?.level === "error") {
        errors.push(evt)
        if (errors.length > 20) errors.shift()
      }
      if (evt.type === "session.status") {
        const id = String(evt.properties?.session_id || "")
        const status = String(evt.properties?.status || "")
        if (status) sessionStatuses[id] = status
      }
      if (evt.type === "session.disposed") {
        delete sessionStatuses[String(evt.properties?.session_id || "")]
      }
    })

    const stateHandler = Effect.fn("MonitorHttpApi.state")(function* () {
      const activeSessions = Object.entries(sessionStatuses).filter(
        ([, s]) => s !== "idle" && s !== "done",
      )

      return {
        server: {
          uptime: Math.floor((Date.now() - startedAt) / 1000),
          version: InstallationVersion,
          channel: InstallationChannel,
          healthy: true as const,
        },
        sessions: {
          active_count: activeSessions.length,
          recent: activeSessions.slice(-10).map(([id, status]) => ({
            id,
            status,
            created_at: 0,
          })),
        },
        events: {
          recent: recent.slice(-20).map((e) => ({
            timestamp: Date.now(),
            type: e.type,
            session_id: String(e.properties?.session_id || undefined),
            properties: e.properties as Record<string, unknown>,
          })),
          errors: errors.slice(-10).map((e) => ({
            timestamp: Date.now(),
            type: e.type,
            session_id: String(e.properties?.session_id || undefined),
            properties: e.properties as Record<string, unknown>,
          })),
        },
        commands: {
          total: commandCount,
          recent: commands.slice(-10).map((e) => ({
            timestamp: Date.now(),
            type: e.type,
            session_id: String(e.properties?.session_id || undefined),
            properties: e.properties as Record<string, unknown>,
          })),
        },
      }
    })

    const eventStream = Effect.fn("MonitorHttpApi.events")(function* () {
      const events = (yield* bus.subscribeAll()).pipe(
        Stream.takeUntil((event) => event.type === Bus.InstanceDisposed.type),
      )

      const heartbeat = Stream.tick("5 seconds").pipe(
        Stream.drop(1),
        Stream.map(
          () =>
            ({
              id: Bus.createID(),
              type: "monitor.heartbeat",
              properties: {
                uptime: Math.floor((Date.now() - startedAt) / 1000),
                active_sessions: Object.entries(sessionStatuses).filter(
                  ([, s]) => s !== "idle" && s !== "done",
                ).length,
              },
            }) as BusEvent,
        ),
      )

      return HttpServerResponse.stream(
        Stream.make({
          id: Bus.createID(),
          type: "monitor.connected",
          properties: { version: InstallationVersion, channel: InstallationChannel },
        }).pipe(
          Stream.concat(events.pipe(Stream.merge(heartbeat, { haltStrategy: "left" }))),
          Stream.map(monitorEventData),
          Stream.pipeThroughChannel(Sse.encode()),
          Stream.encodeText,
          Stream.ensuring(Effect.sync(() => log.info("monitor disconnected"))),
        ),
        {
          contentType: "text/event-stream",
          headers: {
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
          },
        },
      )
    })

    return handlers
      .handle("state", stateHandler)
      .handleRaw("events", eventStream)
  }),
)
