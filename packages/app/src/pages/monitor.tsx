// Monitor GUI page: dashboard showing server health, active sessions,
// command counts, recent events, and LLM endpoint documentation.
// Auto-refreshes every 5 seconds. Route: /monitor
import { useGlobalSDK } from "@/context/global-sdk"

type MonitorState = {
  server: { uptime: number; version: string; channel: string; healthy: true }
  sessions: { active_count: number; recent: Array<{ id: string; status: string }> }
  events: { recent: Array<{ timestamp: number; type: string; properties: Record<string, unknown> }>; errors: any[] }
  commands: { total: number; recent: any[] }
}

function formatUptime(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${m}m`
}

export default function MonitorPage() {
  const gsdk = useGlobalSDK()
  const [state, setState] = createSignal<MonitorState | null>(null)
  const [liveEvents, setLiveEvents] = createSignal<string[]>([])
  const [error, setError] = createSignal("")
  const [autoRefresh, setAutoRefresh] = createSignal(true)

  let eventSource: EventSource | null = null

  const fetchState = async () => {
    try {
      const client = gsdk.createClient({ server: { type: "instance" } })
      const res = await client.get("/monitor/state")
      if (res) setState(res as MonitorState)
    } catch (e) {
      setError(String(e))
    }
  }

  createEffect(() => {
    fetchState()
    const interval = setInterval(() => {
      if (autoRefresh()) fetchState()
    }, 5000)
    onCleanup(() => clearInterval(interval))
  })

  return (
    <div style="padding: 24px; max-width: 1200px; margin: 0 auto; color: #ccc">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px">
        <h1 style="margin: 0; font-size: 24px; color: #fff">Agence Monitor</h1>
        <button onClick={fetchState} style="background:#333;border:1px solid #555;color:#ccc;padding:4px 12px;cursor:pointer;border-radius:4px">Refresh</button>
        <button onClick={() => setAutoRefresh(!autoRefresh())} style="background:#333;border:1px solid #555;color:#ccc;padding:4px 12px;cursor:pointer;border-radius:4px">
          {autoRefresh() ? "Pause" : "Resume"}
        </button>
      </div>

      <Switch>
        <Match when={!state() && !error()}>
          <div style="text-align:center;padding:40px;color:#666">Loading monitor data...</div>
        </Match>
        <Match when={error()}>
          <div style="text-align:center;padding:40px;color:#f44747">Error: {error()}</div>
        </Match>
        <Match when={state()}>
          {(() => {
            const s = state()!
            return (
              <>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px">
                  <div style="background:#1e1e1e;border:1px solid #333;border-radius:8px;padding:16px">
                    <div style="color:#888;font-size:12px;text-transform:uppercase;margin-bottom:8px">Server</div>
                    <div style="font-size:13px;line-height:1.8">
                      <div>Version: <span style="color:#4ec9b0">{s.server.version}</span></div>
                      <div>Channel: <span style="color:#569cd6">{s.server.channel}</span></div>
                      <div>Uptime: <span style="color:#dcdcaa">{formatUptime(s.server.uptime)}</span></div>
                      <div>Status: <span style="color:#4ec9b0">Healthy</span></div>
                    </div>
                  </div>

                  <div style="background:#1e1e1e;border:1px solid #333;border-radius:8px;padding:16px">
                    <div style="color:#888;font-size:12px;text-transform:uppercase;margin-bottom:8px">Active Sessions</div>
                    <div style="font-size:48px;font-weight:700;color:#4ec9b0">{s.sessions.active_count}</div>
                    <div style="font-size:12px;margin-top:8px;max-height:160px;overflow-y:auto">
                      <For each={s.sessions.recent}>
                        {(ss) => <div style="padding:2px 0">{ss.id.slice(0,20)}... <span style={{ color: ss.status === 'active' ? '#4ec9b0' : '#888' }}>{ss.status}</span></div>}
                      </For>
                    </div>
                  </div>

                  <div style="background:#1e1e1e;border:1px solid #333;border-radius:8px;padding:16px">
                    <div style="color:#888;font-size:12px;text-transform:uppercase;margin-bottom:8px">Commands</div>
                    <div style="font-size:48px;font-weight:700;color:#dcdcaa">{s.commands.total}</div>
                    <div style="font-size:12px;margin-top:8px">
                      <For each={s.commands.recent.slice(-5)}>
                        {(c: any) => <div style="padding:1px 0;opacity:0.7">{String(c.properties?.command || c.type).slice(0,40)}</div>}
                      </For>
                    </div>
                  </div>

                  <div style="background:#1e1e1e;border:1px solid #333;border-radius:8px;padding:16px">
                    <div style="color:#888;font-size:12px;text-transform:uppercase;margin-bottom:8px">Recent Events</div>
                    <div style="font-size:12px;max-height:200px;overflow-y:auto">
                      <For each={s.events.recent.slice(-20).reverse()}>
                        {(e) => (
                          <div style="padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
                            <span style={{ color: e.type.includes('error') ? '#f44747' : '#569cd6', fontSize: 11 }}>{e.type}</span>
                            <span style="color:#666;margin-left:6px;font-size:11px">{new Date(e.timestamp).toLocaleTimeString()}</span>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </div>

                <div style="background:#1e1e1e;border:1px solid #333;border-radius:8px;margin-top:12px;padding:16px">
                  <div style="color:#888;font-size:12px;text-transform:uppercase;margin-bottom:8px">LLM Status Endpoint</div>
                  <div style="font-size:12px;font-family:monospace;line-height:1.6">
                    <div><span style="color:#569cd6">GET</span> <span style="color:#ce9178">/monitor/state</span> — JSON snapshot</div>
                    <div><span style="color:#569cd6">GET</span> <span style="color:#ce9178">/monitor/events</span> — SSE live stream</div>
                    <div style="margin-top:8px;color:#888">LLMs: stream /monitor/events to get real-time structured data</div>
                  </div>
                </div>
              </>
            )
          })()}
        </Match>
      </Switch>
    </div>
  )
}
