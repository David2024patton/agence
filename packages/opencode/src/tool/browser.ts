import { Effect, Schema, Stream, Scope } from "effect"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import { ChildProcess } from "effect/unstable/process"
import { AppFileSystem } from "@opencode-ai/core/filesystem"
import os from "os"
import path from "path"
import crypto from "crypto"
import * as Tool from "./tool"
import INSPECT_DESC from "./browser_inspect.txt"
import TUTORIAL_DESC from "./browser_tutorial.txt"
import EXTRACT_DESC from "./browser_extract.txt"
import ANALYZE_DESC from "./browser_analyze.txt"

const BROWSER_BIN = process.env.AGENCE_BROWSER_BIN || "agent-browser"

function id() { return Math.random().toString(36).slice(2, 10) }
const tmpFile = (ext: string) => path.join(os.tmpdir(), `agence-br-${id()}.${ext}`)

function parse(output: string): { success: boolean; data?: Record<string, unknown>; error?: string } | null {
  try {
    for (const line of output.trim().split("\n")) if (line.trim().startsWith("{")) return JSON.parse(line.trim())
    return null
  } catch { return null }
}

// ═══ browser_inspect ═══════════════════════════════════════════════════════

export const InspectParameters = Schema.Struct({
  url: Schema.String.annotate({ description: "URL to open and inspect" }),
  screenshot: Schema.optional(Schema.Boolean).annotate({ description: "Also capture a full-page screenshot. Default: false" }),
})

export const BrowserInspectTool = Tool.define<typeof InspectParameters, { url: string; refs: number }, ChildProcessSpawner | AppFileSystem.Service>(
  "browser_inspect",
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner
    const afs = yield* AppFileSystem.Service
    function run(args: string[]) {
      return Effect.scoped(Effect.gen(function* () {
        const proc = yield* spawner.spawn(ChildProcess.make(BROWSER_BIN, ["--json", ...args]))
        return yield* Stream.decodeText(proc.all).pipe(Stream.runFold(() => "", (a: string, b: string) => a + b))
      }))
    }
    return {
      description: INSPECT_DESC,
      parameters: InspectParameters,
      execute: (params: { url: string; screenshot?: boolean }, _ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* run(["open", params.url])
          const snap = parse(yield* run(["snapshot", "-i", "-u"]))
          const title = parse(yield* run(["get", "title"]))
          const cons = parse(yield* run(["console"]))
          const msgs = (cons?.data?.messages as Array<{ type: string; text: string }> | undefined)?.map((m) => `[${m.type}] ${m.text}`).join("\n") ?? ""

          let screenshotBase64: string | undefined
          if (params.screenshot) {
            const shot = tmpFile("png")
            yield* run(["screenshot", "--full", shot])
            screenshotBase64 = Buffer.from(yield* afs.readFile(shot)).toString("base64")
          }

          return {
            title: `Inspect: ${params.url}`,
            metadata: { url: params.url, refs: snap?.data?.refs ? Object.keys(snap.data.refs as object).length : 0 },
            output: [`## Page: ${title?.data?.title ?? params.url}`, "", "### Accessibility Tree", (snap?.data?.snapshot as string) ?? "", "", "### Console", msgs || "No messages"].join("\n"),
            ...(screenshotBase64 ? { attachments: [{ type: "file" as const, mime: "image/png", url: `data:image/png;base64,${screenshotBase64}` }] } : {}),
          }
        }).pipe(Effect.orDie),
    }
  }),
)

// ═══ browser_tutorial ══════════════════════════════════════════════════════

const TutorialStepSchema = Schema.Struct({
  selector: Schema.String.annotate({ description: "CSS selector or @eN ref" }),
  action: Schema.Literals(["click", "read", "arrow", "note"] as const).annotate({ description: "Visual: click=circle, read=glow, arrow=arrow, note=tooltip" }),
  text: Schema.optional(Schema.String).annotate({ description: "Label or tooltip text" }),
  color: Schema.optional(Schema.String).annotate({ description: "Highlight color (hex)" }),
})

export const TutorialParameters = Schema.Struct({
  steps: Schema.Array(TutorialStepSchema).annotate({ description: "Tutorial steps to render" }),
})

export const BrowserTutorialTool = Tool.define<typeof TutorialParameters, { steps: number }, ChildProcessSpawner | AppFileSystem.Service>(
  "browser_tutorial",
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner
    const afs = yield* AppFileSystem.Service
    function run(args: string[]) {
      return Effect.scoped(Effect.gen(function* () {
        const proc = yield* spawner.spawn(ChildProcess.make(BROWSER_BIN, ["--json", ...args]))
        return yield* Stream.decodeText(proc.all).pipe(Stream.runFold(() => "", (a: string, b: string) => a + b))
      }))
    }
    return {
      description: TUTORIAL_DESC,
      parameters: TutorialParameters,
      execute: (params: { steps: readonly { selector: string; action: string; text?: string; color?: string }[] }, _ctx: Tool.Context) =>
        Effect.gen(function* () {
          for (let i = 0; i < params.steps.length; i++) {
            const s = params.steps[i]; const num = i + 1
            const color = s.color ?? (s.action === "read" ? "#facc15" : s.action === "note" ? "#3b82f6" : "#ef4444")
            if (s.action === "click") yield* run(["eval", `(function(){var el=document.querySelector("${s.selector}");if(!el)return"nf";var d=document.createElement("div");d.style.cssText="position:absolute;z-index:2147483647;pointer-events:none;width:40px;height:40px;border:3px solid ${color};border-radius:50%;animation:agPulse 1s ease-in-out infinite;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;color:${color};font-family:monospace";var r=el.getBoundingClientRect();d.style.left=(r.left+r.width/2-20+window.scrollX)+"px";d.style.top=(r.top+r.height/2-20+window.scrollY)+"px";d.textContent="${num}";d.id="ag-tut-${num}";document.body.appendChild(d);return"ok"})()`])
            else if (s.action === "read") yield* run(["eval", `(function(){var el=document.querySelector("${s.selector}");if(!el)return"nf";el.style.boxShadow="0 0 20px 4px ${color}";el.style.transition="box-shadow 0.3s";el.style.backgroundColor="rgba(250,204,21,0.15)";return"ok"})()`])
            else if (s.action === "note") yield* run(["eval", `(function(){var el=document.querySelector("${s.selector}");if(!el)return"nf";var r=el.getBoundingClientRect();var n=document.createElement("div");n.style.cssText="position:absolute;z-index:2147483647;pointer-events:none;padding:8px 12px;border-radius:6px;background:${color};color:white;font-size:14px;font-family:sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.3);max-width:300px";n.style.left=(r.left+window.scrollX)+"px";n.style.top=(r.top-40+window.scrollY)+"px";n.textContent="${(s.text ?? "Step " + num).replace(/"/g, '\\"')}";n.id="ag-tut-${num}";document.body.appendChild(n);return"ok"})()`])
          }
          const shot = tmpFile("png"); yield* run(["screenshot", shot])
          const base64 = Buffer.from(yield* afs.readFile(shot)).toString("base64")
          return {
            title: `Tutorial: ${params.steps.length} steps`, metadata: { steps: params.steps.length },
            output: `Tutorial with ${params.steps.length} visual guides.`,
            attachments: [{ type: "file" as const, mime: "image/png", url: `data:image/png;base64,${base64}` }],
          }
        }).pipe(Effect.orDie),
    }
  }),
)

// ═══ browser_extract ═══════════════════════════════════════════════════════

export const ExtractParameters = Schema.Struct({
  selector: Schema.optional(Schema.String).annotate({ description: "CSS selector. Omit for full page." }),
})

export const BrowserExtractTool = Tool.define<typeof ExtractParameters, { selector: string }, ChildProcessSpawner>(
  "browser_extract",
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner
    function run(args: string[]) {
      return Effect.scoped(Effect.gen(function* () {
        const proc = yield* spawner.spawn(ChildProcess.make(BROWSER_BIN, ["--json", ...args]))
        return yield* Stream.decodeText(proc.all).pipe(Stream.runFold(() => "", (a: string, b: string) => a + b))
      }))
    }
    return {
      description: EXTRACT_DESC,
      parameters: ExtractParameters,
      execute: (params: { selector?: string }, _ctx: Tool.Context) =>
        Effect.gen(function* () {
          const sel = params.selector || "body"
          const pe = (raw: string) => { const j = parse(raw); return (j?.data?.result && typeof j.data.result === "string") ? JSON.parse(j.data.result) : null }
          const colors = pe(yield* run(["eval", `(function(){var all=document.querySelectorAll("*");var colors=new Set();all.forEach(function(el){var c=getComputedStyle(el);if(c.color)colors.add(c.color);if(c.backgroundColor&&c.backgroundColor!=="rgba(0, 0, 0, 0)")colors.add(c.backgroundColor)});return JSON.stringify({count:colors.size,values:Array.from(colors).slice(0,50)})})()`])) as { count: number; values: string[] } | null
          const fonts = pe(yield* run(["eval", `(function(){var all=document.querySelectorAll("*");var fonts=new Set();all.forEach(function(el){var c=getComputedStyle(el);fonts.add(c.fontFamily+"|"+c.fontSize)});return JSON.stringify({count:fonts.size,values:Array.from(fonts).slice(0,30)})})()`])) as { count: number; values: string[] } | null
          const styles = parse(yield* run(["get", "styles", sel]))
          const html = parse(yield* run(["get", "html", sel]))
          return {
            title: `Extract: ${sel}`, metadata: { selector: sel },
            output: [
              "## Design Extraction", "", `### Colors (${colors?.count ?? 0})`, (colors?.values ?? []).slice(0, 20).map((c: string) => `  ${c}`).join("\n") || "  N/A",
              "", `### Typography (${fonts?.count ?? 0})`, (fonts?.values ?? []).slice(0, 20).map((f: string) => `  ${f}`).join("\n") || "  N/A",
              "", `### Styles (${sel})`, styles?.data?.styles ? JSON.stringify(styles.data.styles, null, 2) : "N/A",
              "", `### HTML (${sel})`, ((html?.data?.html as string) ?? "N/A").slice(0, 2000),
            ].join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)

// ═══ browser_analyze ═══════════════════════════════════════════════════════

export const AnalyzeParameters = Schema.Struct({})

export const BrowserAnalyzeTool = Tool.define<typeof AnalyzeParameters, { frameworks: readonly string[] }, ChildProcessSpawner>(
  "browser_analyze",
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner
    function run(args: string[]) {
      return Effect.scoped(Effect.gen(function* () {
        const proc = yield* spawner.spawn(ChildProcess.make(BROWSER_BIN, ["--json", ...args]))
        return yield* Stream.decodeText(proc.all).pipe(Stream.runFold(() => "", (a: string, b: string) => a + b))
      }))
    }
    return {
      description: ANALYZE_DESC,
      parameters: AnalyzeParameters,
      execute: (_params: {}, _ctx: Tool.Context) =>
        Effect.gen(function* () {
          const j = parse(yield* run(["eval", `(function(){var d={};d.react=!!(window.React||document.getElementById("__next")||document.querySelector("[data-reactroot]"));d.vue=!!(window.Vue||document.querySelector("[data-v-]"));d.angular=!!(window.ng||document.querySelector("[ng-version]"));d.svelte=!!document.querySelector("[data-sveltekit-]");d.nextjs=!!(document.getElementById("__next")||window.__NEXT_DATA__);d.tailwind=!!document.querySelector("[class*='tw-']")||Array.from(document.styleSheets).some(function(s){try{return Array.from(s.cssRules).some(function(r){return r.cssText&&r.cssText.indexOf('--tw-')!==-1})}catch(e){return false}});d.jQuery=!!window.jQuery;d.webpack=!!window.webpackJsonp;d.vite=!!window.__vite_plugin_react_preamble_installed__||!!document.querySelector('script[src*="@vite/client"]');d.analytics=!!(window.gtag||window.dataLayer);d.meta=Array.from(document.querySelectorAll("meta[name]")).map(function(m){return{name:m.getAttribute("name"),content:m.getAttribute("content")}});d.lang=document.documentElement.lang||"unknown";d.title=document.title;d.scripts=Array.from(document.querySelectorAll("script[src]")).map(function(s){return s.getAttribute("src")}).slice(0,20);return JSON.stringify(d)})()`]))
          const data = (j?.data?.result && typeof j.data.result === "string") ? JSON.parse(j.data.result) as Record<string, unknown> : {}
          const langs: string[] = []; if (data.react) langs.push("React"); if (data.vue) langs.push("Vue"); if (data.angular) langs.push("Angular"); if (data.svelte) langs.push("Svelte"); if (data.nextjs) langs.push("Next.js"); if (data.jQuery) langs.push("jQuery")
          const tools: string[] = []; if (data.webpack) tools.push("webpack"); if (data.vite) tools.push("Vite"); if (data.tailwind) tools.push("Tailwind CSS")
          const metas = (data.meta as Array<{ name: string; content: string }> | undefined)?.slice(0, 10) ?? []
          const scripts = (data.scripts as string[] | undefined)?.slice(0, 8) ?? []
          return {
            title: `Analyze: ${data.title ?? "Unknown"}`, metadata: { frameworks: langs },
            output: [`## Architecture: ${data.title ?? "Unknown"}`, `Language: ${data.lang ?? "unknown"}`, "", "### Frameworks", langs.length ? langs.map((l: string) => `  - ${l}`).join("\n") : "  None detected", "", "### Build & CSS", tools.length ? tools.map((t: string) => `  - ${t}`).join("\n") : "  None detected", "", "### Analytics", data.analytics ? "  GA/GTM detected" : "  None detected", "", "### Meta", metas.map((m: { name: string; content: string }) => `  ${m.name}: ${m.content.slice(0, 80)}`).join("\n") || "  N/A", "", "### Scripts", scripts.map((s: string) => `  ${s}`).join("\n") || "  N/A"].join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)

// ═══ browser_close ═════════════════════════════════════════════════════════

export const CloseParameters = Schema.Struct({})

export const BrowserCloseTool = Tool.define<typeof CloseParameters, {}, ChildProcessSpawner>(
  "browser_close",
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner
    return {
      description: "Close the browser and end the session. Always call this when done with browser work.",
      parameters: CloseParameters,
      execute: (_params: {}, _ctx: Tool.Context) =>
        Effect.scoped(Effect.gen(function* () {
          const proc = yield* spawner.spawn(ChildProcess.make(BROWSER_BIN, ["--json", "close"]))
          yield* Stream.decodeText(proc.all).pipe(Stream.runDrain)
          return { title: "Browser Closed", metadata: {}, output: "Browser closed." }
        })).pipe(Effect.orDie),
    }
  }),
)

// ═══ browser_screenshot ═════════════════════════════════════════════════════

export const ScreenshotParams = Schema.Struct({
  selector: Schema.optional(Schema.String).annotate({ description: "CSS selector to scope screenshot to a specific element" }),
  fullPage: Schema.optional(Schema.Boolean).annotate({ description: "Capture full scrollable page. Default: false (viewport only)" }),
})

export const BrowserScreenshotTool = Tool.define<typeof ScreenshotParams, {}, ChildProcessSpawner | AppFileSystem.Service>(
  "browser_screenshot",
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner
    const afs = yield* AppFileSystem.Service
    function run(args: string[]) {
      return Effect.scoped(Effect.gen(function* () {
        const proc = yield* spawner.spawn(ChildProcess.make(BROWSER_BIN, ["--json", ...args]))
        return yield* Stream.decodeText(proc.all).pipe(Stream.runFold(() => "", (a: string, b: string) => a + b))
      }))
    }
    return {
      description: "Take a screenshot of the current browser page. Returns a base64 PNG the LLM can see. The browser must already be open (use browser_inspect first). Supports full-page capture and element-scoped screenshots.",
      parameters: ScreenshotParams,
      execute: (params: { selector?: string; fullPage?: boolean }, _ctx: Tool.Context) =>
        Effect.gen(function* () {
          const shot = tmpFile("png")
          const args = ["screenshot"]
          if (params.fullPage) args.push("--full")
          if (params.selector) args.push("--selector", params.selector)
          args.push(shot)
          yield* run(args)
          const base64 = Buffer.from(yield* afs.readFile(shot)).toString("base64")
          return {
            title: "Browser Screenshot",
            metadata: {},
            output: "Screenshot captured.",
            attachments: [{ type: "file" as const, mime: "image/png", url: `data:image/png;base64,${base64}` }],
          }
        }).pipe(Effect.orDie),
    }
  }),
)
