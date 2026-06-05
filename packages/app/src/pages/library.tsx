import { createSignal, createMemo, For, Show, createEffect } from "solid-js"
import { useGlobalSDK } from "@/context/global-sdk"
import { useLanguage } from "@/context/language"
import { useNavigate, useSearchParams } from "@solidjs/router"
import { useServer } from "@/context/server"
import { usePlatform } from "@/context/platform"
import { useSettingsWorkspaceDirectory } from "@/utils/settings-learning"
import { instanceHttpRequest } from "@/utils/instance-http"

const GITHUB_CSS = `
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 16px; line-height: 1.6; color: #c9d1d9; background: #0d1117;
  max-width: 900px; margin: 0 auto; padding: 32px 24px;
}
h1 { font-size: 2em; font-weight: 600; border-bottom: 1px solid #21262d; padding-bottom: .3em; margin: 24px 0 16px; color: #f0f6fc; }
h2 { font-size: 1.5em; font-weight: 600; border-bottom: 1px solid #21262d; padding-bottom: .3em; margin: 24px 0 16px; color: #f0f6fc; }
h3 { font-size: 1.25em; font-weight: 600; margin: 24px 0 16px; color: #f0f6fc; }
h4 { font-size: 1em; font-weight: 600; margin: 24px 0 16px; color: #f0f6fc; }
p { margin: 0 0 16px; }
a { color: #58a6ff; text-decoration: none; }
a:hover { text-decoration: underline; }
strong { color: #f0f6fc; font-weight: 600; }
code { background: #343941; padding: .2em .4em; border-radius: 6px; font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace; font-size: 85%; }
pre { background: #161b22; border-radius: 6px; padding: 16px; overflow-x: auto; margin: 0 0 16px; }
pre code { background: none; padding: 0; font-size: 100%; }
ul, ol { padding-left: 2em; margin: 0 0 16px; }
li { margin: 0 0 4px; }
li > ul, li > ol { margin: 4px 0; }
blockquote { border-left: 4px solid #3b434b; padding: 0 1em; color: #8b949e; margin: 0 0 16px; }
table { border-collapse: collapse; width: 100%; margin: 0 0 16px; }
th, td { border: 1px solid #30363d; padding: 8px 13px; text-align: left; }
th { background: #161b22; font-weight: 600; }
tr:nth-child(even) { background: #0d1117; }
tr:nth-child(odd) { background: #161b22; }
hr { border: none; border-top: 1px solid #21262d; margin: 24px 0; }
img { max-width: 100%; }
.wiki-link { color: #7ee787; border-bottom: 1px dotted #7ee787; cursor: default; }
`

function renderGitHubHTML(md: string): string {
  // Remove BOM
  md = md.replace(/^\uFEFF/, "")
  // Split into lines for processing
  const lines = md.split("\n")
  let html = ""
  let inCodeBlock = false
  let codeContent = ""
  let codeLang = ""
  let inList = false
  let listType = ""
  let listItems: string[] = []

  function flushList() {
    if (!inList || listItems.length === 0) return
    const tag = listType === "ul" ? "ul" : "ol"
    html += `<${tag}>${listItems.join("")}</${tag}>\n`
    listItems = []
    inList = false
    listType = ""
  }

  function escapeHtml(s: string) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  }

  function inlineFormat(s: string): string {
    // Bold (must be before italic or * in bold catches it)
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    s = s.replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Inline code
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>")
    // Wiki links
    s = s.replace(/\[\[(.+?)\]\]/g, '<span class="wiki-link">$1</span>')
    return s
  }

  function processLine(line: string): string {
    // Inside code block
    if (inCodeBlock) {
      if (line.trim() === "```") {
        inCodeBlock = false
        const lang = codeLang ? ` class="language-${codeLang}"` : ""
        const result = `<pre><code${lang}>${escapeHtml(codeContent.trim())}</code></pre>`
        codeContent = ""
        codeLang = ""
        return result
      }
      codeContent += (codeContent ? "\n" : "") + line
      return ""
    }

    // Start of code block
    if (line.startsWith("```")) {
      inCodeBlock = true
      codeLang = line.slice(3).trim()
      return ""
    }

    // Empty line
    if (line.trim() === "") {
      const result = flushList()
      return "<br>"
    }

    // Headings
    const hMatch = line.match(/^(#{1,4})\s+(.+)/)
    if (hMatch) {
      flushList()
      const level = hMatch[1].length
      return `<h${level}>${inlineFormat(escapeHtml(hMatch[2]))}</h${level}>`
    }

    // Horizontal rule
    if (line.match(/^---+$/)) {
      flushList()
      return "<hr>"
    }

    // Blockquote
    if (line.startsWith("> ")) {
      flushList()
      return `<blockquote><p>${inlineFormat(escapeHtml(line.slice(2)))}</p></blockquote>`
    }

    // Unordered list
    if (line.match(/^-\s/)) {
      if (!inList || listType !== "ul") {
        flushList()
        inList = true
        listType = "ul"
      }
      listItems.push(`<li>${inlineFormat(escapeHtml(line.slice(2)))}</li>`)
      return ""
    }

    // Ordered list
    if (line.match(/^\d+\.\s/)) {
      if (!inList || listType !== "ol") {
        flushList()
        inList = true
        listType = "ol"
      }
      const text = line.replace(/^\d+\.\s/, "")
      listItems.push(`<li>${inlineFormat(escapeHtml(text))}</li>`)
      return ""
    }

    // Regular paragraph
    flushList()
    return `<p>${inlineFormat(escapeHtml(line))}</p>`
  }

  for (const line of lines) {
    html += processLine(line) + "\n"
  }
  flushList()

  // Close any open code block
  if (inCodeBlock) {
    html += `<pre><code>${escapeHtml(codeContent.trim())}</code></pre>`
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${GITHUB_CSS}</style></head><body>${html.trim()}</body></html>`
}

interface WikiFile {
  name: string
  content: string
  html?: string
  links: string[]
  backlinks: string[]
}

export default function LibraryPage() {
  const gsdk = useGlobalSDK()
  const server = useServer()
  const platform = usePlatform()
  const language = useLanguage()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const workspaceDirectory = useSettingsWorkspaceDirectory()
  const [files, setFiles] = createSignal<WikiFile[]>([])
  const [selected, setSelected] = createSignal<string | null>(null)
  const [search, setSearch] = createSignal("")
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal("")
  const [kbPath, setKbPath] = createSignal("")

  const directory = createMemo(() => {
    const fromQuery = searchParams.directory
    if (typeof fromQuery === "string" && fromQuery.length > 0) return fromQuery
    return workspaceDirectory() ?? ""
  })

  const fetchFiles = async () => {
    const dir = directory()
    if (!dir) {
      setFiles([])
      setError(language.t("directory.error.projectRequired"))
      setLoading(false)
      return
    }
    setLoading(true)
    setError("")
    try {
      const data = await instanceHttpRequest<{ path: string; files: WikiFile[] }>({
        baseUrl: gsdk.url,
        server: server.current,
        directory: dir,
        fetch: platform.fetch,
        method: "GET",
        path: "/library/list",
      })
      setFiles(
        (data.files ?? []).map((file) => ({
          ...file,
          html: renderGitHubHTML(file.content),
        })),
      )
      setKbPath(data.path || "")
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (message.includes("HTTP 500")) {
        setError(
          `${message} — quit Agence Desktop fully, run \`bun dev:desktop\` from the repo root (rebuilds the sidecar), then reopen Knowledge.`,
        )
        return
      }
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const selectFile = (name: string) => {
    setSelected(name)
    setError("")
  }

  createEffect(() => {
    const dir = directory()
    if (!dir) {
      setFiles([])
      setError(language.t("directory.error.projectRequired"))
      setLoading(false)
      return
    }
    void fetchFiles()
  })

  const filtered = createMemo(() => {
    const s = search().toLowerCase()
    if (!s) return files()
    return files().filter(f =>
      f.name.toLowerCase().includes(s) || f.content.toLowerCase().includes(s)
    )
  })

  const selectedFile = createMemo(() => files().find(f => f.name === selected()))

  return (
    <div class="size-full flex bg-v2-background-bg-deep">
      <div class="w-64 shrink-0 border-r border-v2-border-weak-base flex flex-col">
        <div class="p-3 border-b border-v2-border-weak-base">
          <div class="flex items-center gap-2 mb-2">
            <button onClick={() => navigate("/")} class="text-v2-text-text-faint hover:text-v2-text-text-base p-1" aria-label="Back">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8L10 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
            <h2 class="text-14-medium text-v2-text-text-base flex-1">Knowledge</h2>
            <button onClick={fetchFiles} class="text-v2-text-text-faint hover:text-v2-text-text-base text-11 px-1">Reload</button>
          </div>
          <div class="relative">
            <svg class="absolute left-2 top-1/2 -translate-y-1/2 text-v2-text-text-faint" width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="5" cy="5" r="3.5" stroke="currentColor"/><path d="M7.5 7.5L10 10" stroke="currentColor" stroke-linecap="round"/></svg>
            <input type="text" placeholder="Search wiki..." value={search()} onInput={(e) => setSearch(e.currentTarget.value)}
              class="w-full bg-v2-background-bg-layer-02 text-v2-text-text-base text-12 pl-7 pr-2 py-1.5 rounded outline-none border border-transparent focus:border-v2-border-accent-base" />
          </div>
        </div>

        <Show when={error()}>
          <div class="p-2 mx-2 mt-1 text-11 text-[#f48771] bg-[#f4877111] rounded border border-[#f4877133] select-all whitespace-pre-wrap break-all relative group">
            {error()}
            <button class="absolute top-1 right-1 text-10 px-1.5 py-0.5 rounded bg-[#f4877122] hover:bg-[#f4877133] text-[#f48771] opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => navigator.clipboard.writeText(error())}>Copy</button>
          </div>
        </Show>

        <div class="flex-1 overflow-y-auto">
          <Show when={!loading()}
            fallback={<div class="p-3 text-v2-text-text-faint text-12">Loading...</div>}
          >
            <Show when={files().length > 0}
              fallback={<div class="p-3 text-v2-text-text-faint text-12">No articles yet.</div>}
            >
              <For each={filtered()}>
                {(f) => (
                  <button onClick={() => selectFile(f.name)}
                    class="w-full text-left px-3 py-2 text-12 hover:bg-v2-background-bg-layer-02 transition-colors border-l-2"
                    classList={{
                      "border-transparent": selected() !== f.name,
                      "border-v2-border-accent-base bg-v2-background-bg-layer-02": selected() === f.name,
                    }}>
                    <div class="text-v2-text-text-base truncate">{f.name.replace(".md", "").replace(/-/g, " ")}</div>
                    <div class="text-v2-text-text-faint text-11 mt-0.5">{f.links?.length || 0} links</div>
                  </button>
                )}
              </For>
            </Show>
          </Show>
        </div>
        {kbPath() && <div class="p-2 border-t border-v2-border-weak-base text-11 text-v2-text-text-faint truncate">{kbPath()}</div>}
      </div>

      <div class="flex-1 min-w-0 overflow-y-auto bg-background-base"><div class="max-w-3xl mx-auto p-8">
        {(() => {
          if (!directory()) {
            return (
              <div class="flex items-center justify-center h-full text-v2-text-text-faint text-13">
                <div class="text-center max-w-sm">
                  <div class="text-3xl mb-2">&#x1F4C1;</div>
                  <div class="text-v2-text-text-base mb-1">{language.t("directory.error.projectRequired")}</div>
                </div>
              </div>
            )
          }
          const file = selectedFile()
          if (!file) return (
            <div class="flex items-center justify-center h-full text-v2-text-text-faint text-13">
              <div class="text-center">
                <div class="text-3xl mb-2">&#x1F4DA;</div>
                <div class="text-v2-text-text-base mb-1">Knowledge Base Library</div>
                <div>{files().length > 0 ? "Select a topic from the sidebar" : "No wiki articles yet."}</div>
              </div>
            </div>
          )
          return (
            <div class="max-w-3xl">
              <h1 class="text-20-semibold text-v2-text-text-base mb-1 capitalize">
                {file.name.replace(".md", "").replace(/-/g, " ")}
              </h1>
              <div class="text-10 text-[#888] mb-2">
                Content: {typeof file.content} ({file.content?.length || 0}b) | Links: {file.links?.length || 0}
              </div>
              {file.links && file.links.length > 0 && (
                <div class="flex flex-wrap gap-1.5 mb-4">
                  <For each={file.links}>
                    {(link) => (
                      <button onClick={() => selectFile(link + ".md")}
                        class="text-11 px-2 py-0.5 rounded bg-v2-background-bg-layer-02 text-v2-text-text-faint hover:text-v2-text-text-base border border-v2-border-weak-base">
                        {link.replace(/-/g, " ")}
                      </button>
                    )}
                  </For>
                </div>
              )}
              <div>
                {file.html ? (
                  <iframe
                    srcdoc={'<!DOCTYPE html><html><head><meta charset="utf-8"><style>' + GITHUB_CSS + '</style></head><body>' + file.html + '</body></html>'}
                    class="w-full border-none rounded-lg"
                    style="min-height: 600px; height: calc(100vh - 220px); background: #0d1117"
                    sandbox="allow-same-origin"
                  />
                ) : file.content ? (
                  <iframe
                    srcdoc={'<!DOCTYPE html><html><head><meta charset="utf-8"><style>' + GITHUB_CSS + '</style></head><body><pre>' + file.content.replace(/</g, '&lt;') + '</pre></body></html>'}
                    class="w-full border-none rounded-lg"
                    style="min-height: 600px; height: calc(100vh - 220px); background: #0d1117"
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <span>No content loaded for this file</span>
                )}
              </div>
              {file.backlinks && file.backlinks.length > 0 && (
                <div class="mt-8 pt-4 border-t border-v2-border-weak-base">
                  <h3 class="text-11 text-v2-text-text-faint mb-2">Referenced by</h3>
                  <div class="flex flex-wrap gap-1.5">
                    <For each={file.backlinks}>
                      {(link) => (
                        <button onClick={() => selectFile(link + ".md")}
                          class="text-11 px-2 py-0.5 rounded bg-v2-background-bg-layer-02 text-v2-text-text-faint hover:text-v2-text-text-base border border-v2-border-weak-base">
                          {link.replace(/-/g, " ")}
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              )}
            </div>
          )
        })()}
      </div>
      </div>
    </div>
  )
}
