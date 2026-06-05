import { createEffect, createSignal, For, Match, onCleanup, Show, Switch } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { Button } from "@agence-ai/ui/button"
import { Icon } from "@agence-ai/ui/icon"
import { useGlobalSDK } from "@/context/global-sdk"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { instanceHttpRequest } from "@/utils/instance-http"

type MonitorEvent = {
  timestamp: number
  type: string
  properties: Record<string, unknown>
}

type MonitorState = {
  server: { uptime: number; version: string; channel: string; healthy: true }
  sessions: { active_count: number; recent: Array<{ id: string; status: string }> }
  events: { recent: MonitorEvent[]; errors: MonitorEvent[] }
  commands: { total: number; recent: MonitorEvent[] }
}

function formatUptime(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function eventLabel(event: MonitorEvent) {
  const command = event.properties?.command
  if (typeof command === "string" && command) return command
  return event.type
}

function StatCard(props: {
  label: string
  value: string
  accent?: "default" | "success" | "warn"
  children?: import("solid-js").JSX.Element
}) {
  const valueClass = () => {
    if (props.accent === "success") return "text-v2-text-text-success"
    if (props.accent === "warn") return "text-v2-text-text-warning"
    return "text-v2-text-text-base"
  }

  return (
    <section class="flex flex-col gap-3 rounded-xl border border-v2-border-weak-base bg-v2-background-bg-base p-4 shadow-[var(--v2-elevation-raised)]">
      <h2 class="text-11-medium uppercase tracking-wide text-v2-text-text-faint">{props.label}</h2>
      <p classList={{ "text-36-semibold tabular-nums leading-none": true, [valueClass()]: true }}>{props.value}</p>
      <Show when={props.children}>{props.children}</Show>
    </section>
  )
}

function Row(props: { label: string; value: string; valueClass?: string }) {
  return (
    <div class="flex items-center justify-between gap-3 text-12-regular">
      <span class="text-v2-text-text-faint">{props.label}</span>
      <span classList={{ "font-medium tabular-nums": true, [props.valueClass ?? "text-v2-text-text-base"]: !!props.valueClass }}>
        {props.value}
      </span>
    </div>
  )
}

function EventList(props: { events: MonitorEvent[]; empty: string }) {
  return (
    <Show
      when={props.events.length > 0}
      fallback={<p class="text-12-regular text-v2-text-text-faint py-2">{props.empty}</p>}
    >
      <ul class="flex flex-col gap-0.5 max-h-52 overflow-y-auto no-scrollbar">
        <For each={props.events}>
          {(event) => (
            <li class="flex items-baseline gap-2 py-1.5 border-b border-v2-border-weaker-base last:border-0">
              <span
                classList={{
                  "text-11-medium shrink-0": true,
                  "text-v2-text-text-critical": event.type.includes("error"),
                  "text-v2-text-text-info": !event.type.includes("error"),
                }}
              >
                {event.type}
              </span>
              <span class="text-11-regular text-v2-text-text-faint truncate flex-1 min-w-0">
                {eventLabel(event)}
              </span>
              <time class="text-10-regular text-v2-text-text-faint tabular-nums shrink-0">
                {new Date(event.timestamp).toLocaleTimeString()}
              </time>
            </li>
          )}
        </For>
      </ul>
    </Show>
  )
}

export default function MonitorPage() {
  const language = useLanguage()
  const navigate = useNavigate()
  const gsdk = useGlobalSDK()
  const server = useServer()
  const platform = usePlatform()
  const [state, setState] = createSignal<MonitorState | null>(null)
  const [error, setError] = createSignal("")
  const [autoRefresh, setAutoRefresh] = createSignal(true)
  const [refreshing, setRefreshing] = createSignal(false)

  const fetchState = async () => {
    setRefreshing(true)
    try {
      const res = await instanceHttpRequest<MonitorState>({
        baseUrl: gsdk.url,
        server: server.current,
        fetch: platform.fetch,
        method: "GET",
        path: "/monitor/state",
      })
      if (res) {
        setState(res)
        setError("")
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setRefreshing(false)
    }
  }

  createEffect(() => {
    void fetchState()
    const interval = setInterval(() => {
      if (autoRefresh()) void fetchState()
    }, 5000)
    onCleanup(() => clearInterval(interval))
  })

  const recentEvents = () => [...(state()?.events.recent ?? [])].slice(-20).reverse()
  const recentErrors = () => state()?.events.errors ?? []

  return (
    <div data-component="monitor-page" class="size-full flex flex-col bg-v2-background-bg-deep text-v2-text-text-base">
      <header class="shrink-0 border-b border-v2-border-weak-base bg-v2-background-bg-base px-4 py-3 sm:px-6">
        <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            class="flex size-8 items-center justify-center rounded-lg text-v2-icon-icon-muted hover:bg-v2-background-bg-layer-02 hover:text-v2-text-text-base transition-colors"
            aria-label={language.t("monitor.back")}
          >
            <Icon name="arrow-left" size="small" />
          </button>
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            <h1 class="text-16-medium text-v2-text-text-base">{language.t("monitor.title")}</h1>
            <p class="text-12-regular text-v2-text-text-faint">{language.t("monitor.subtitle")}</p>
          </div>
          <div class="flex items-center gap-2">
            <Show when={autoRefresh()}>
              <span class="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-v2-border-weak-base bg-v2-background-bg-layer-02 px-2.5 py-1 text-11-regular text-v2-text-text-faint">
                <span class="size-1.5 rounded-full bg-v2-text-text-success animate-pulse" />
                {language.t("monitor.live")}
              </span>
            </Show>
            <Button size="small" variant="secondary" disabled={refreshing()} onClick={() => void fetchState()}>
              {refreshing() ? language.t("monitor.refreshing") : language.t("monitor.refresh")}
            </Button>
            <Button
              size="small"
              variant={autoRefresh() ? "primary" : "secondary"}
              onClick={() => setAutoRefresh(!autoRefresh())}
            >
              {autoRefresh() ? language.t("monitor.pause") : language.t("monitor.resume")}
            </Button>
          </div>
        </div>
      </header>

      <main class="flex-1 min-h-0 overflow-y-auto px-4 py-6 sm:px-6">
        <div class="mx-auto flex max-w-6xl flex-col gap-6">
          <Switch>
            <Match when={!state() && !error()}>
              <div class="flex flex-col items-center justify-center gap-3 py-24 text-v2-text-text-faint">
                <Icon name="status" class="size-8 opacity-50" />
                <p class="text-14-regular">{language.t("monitor.loading")}</p>
              </div>
            </Match>

            <Match when={error()}>
              <div class="rounded-xl border border-v2-border-critical-base bg-v2-background-bg-critical/10 p-4">
                <p class="text-14-medium text-v2-text-text-critical mb-1">{language.t("monitor.errorTitle")}</p>
                <p class="text-12-regular text-v2-text-text-faint break-all">{error()}</p>
                <Button size="small" variant="secondary" class="mt-3" onClick={() => void fetchState()}>
                  {language.t("monitor.retry")}
                </Button>
              </div>
            </Match>

            <Match when={state()}>
              {(s) => (
                <>
                  <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label={language.t("monitor.card.sessions")} value={String(s().sessions.active_count)} accent="success">
                      <Show
                        when={s().sessions.recent.length > 0}
                        fallback={
                          <p class="text-12-regular text-v2-text-text-faint">{language.t("monitor.sessions.empty")}</p>
                        }
                      >
                        <ul class="flex flex-col gap-1 max-h-28 overflow-y-auto no-scrollbar">
                          <For each={s().sessions.recent}>
                            {(session) => (
                              <li class="flex items-center justify-between gap-2 text-11-regular">
                                <span class="font-mono text-v2-text-text-faint truncate">{session.id.slice(0, 18)}…</span>
                                <span
                                  classList={{
                                    "shrink-0 rounded px-1.5 py-0.5 text-10-medium": true,
                                    "bg-v2-background-bg-success/15 text-v2-text-text-success":
                                      session.status === "active" || session.status === "running",
                                    "bg-v2-background-bg-layer-02 text-v2-text-text-faint": session.status !== "active" && session.status !== "running",
                                  }}
                                >
                                  {session.status}
                                </span>
                              </li>
                            )}
                          </For>
                        </ul>
                      </Show>
                    </StatCard>

                    <StatCard label={language.t("monitor.card.commands")} value={String(s().commands.total)} accent="warn">
                      <EventList
                        events={[...s().commands.recent].slice(-5).reverse()}
                        empty={language.t("monitor.commands.empty")}
                      />
                    </StatCard>

                    <section class="flex flex-col gap-3 rounded-xl border border-v2-border-weak-base bg-v2-background-bg-base p-4 shadow-[var(--v2-elevation-raised)] sm:col-span-2 xl:col-span-2">
                      <h2 class="text-11-medium uppercase tracking-wide text-v2-text-text-faint">
                        {language.t("monitor.card.server")}
                      </h2>
                      <div class="flex flex-col gap-2.5">
                        <Row label={language.t("monitor.server.version")} value={s().server.version} valueClass="text-v2-text-text-info" />
                        <Row label={language.t("monitor.server.channel")} value={s().server.channel} />
                        <Row
                          label={language.t("monitor.server.uptime")}
                          value={formatUptime(s().server.uptime)}
                          valueClass="text-v2-text-text-warning"
                        />
                        <Row
                          label={language.t("monitor.server.status")}
                          value={language.t("monitor.server.healthy")}
                          valueClass="text-v2-text-text-success"
                        />
                      </div>
                    </section>
                  </div>

                  <div class="grid gap-4 lg:grid-cols-2">
                    <section class="flex flex-col gap-3 rounded-xl border border-v2-border-weak-base bg-v2-background-bg-base p-4 shadow-[var(--v2-elevation-raised)]">
                      <h2 class="text-11-medium uppercase tracking-wide text-v2-text-text-faint">
                        {language.t("monitor.card.events")}
                      </h2>
                      <EventList events={recentEvents()} empty={language.t("monitor.events.empty")} />
                    </section>

                    <section class="flex flex-col gap-3 rounded-xl border border-v2-border-weak-base bg-v2-background-bg-base p-4 shadow-[var(--v2-elevation-raised)]">
                      <h2 class="text-11-medium uppercase tracking-wide text-v2-text-text-faint">
                        {language.t("monitor.card.errors")}
                      </h2>
                      <EventList events={recentErrors()} empty={language.t("monitor.errors.empty")} />
                    </section>
                  </div>

                  <section class="rounded-xl border border-v2-border-weak-base bg-v2-background-bg-layer-02 p-4">
                    <h2 class="text-11-medium uppercase tracking-wide text-v2-text-text-faint mb-3">
                      {language.t("monitor.api.title")}
                    </h2>
                    <div class="flex flex-col gap-2 font-mono text-12-regular">
                      <div class="flex flex-wrap items-center gap-2 rounded-lg bg-v2-background-bg-deep px-3 py-2 border border-v2-border-weaker-base">
                        <span class="text-v2-text-text-info font-medium">GET</span>
                        <span class="text-v2-text-text-base">/monitor/state</span>
                        <span class="text-v2-text-text-faint">— {language.t("monitor.api.state")}</span>
                      </div>
                      <div class="flex flex-wrap items-center gap-2 rounded-lg bg-v2-background-bg-deep px-3 py-2 border border-v2-border-weaker-base">
                        <span class="text-v2-text-text-info font-medium">GET</span>
                        <span class="text-v2-text-text-base">/monitor/events</span>
                        <span class="text-v2-text-text-faint">— {language.t("monitor.api.events")}</span>
                      </div>
                    </div>
                    <p class="mt-3 text-12-regular text-v2-text-text-faint">{language.t("monitor.api.hint")}</p>
                  </section>
                </>
              )}
            </Match>
          </Switch>
        </div>
      </main>
    </div>
  )
}
