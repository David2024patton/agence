import { Effect, Schema } from "effect"
import { AppFileSystem } from "@agence-ai/core/filesystem"
import { InstanceState } from "@/effect/instance-state"
import path from "path"
import fs from "fs"
import * as Tool from "./tool"
import DESC from "./plugin_marketplace.txt"

const VENDOR_DIR = (() => {
  // Check env var first, then common locations
  const envDir = process.env.AGENCE_VENDOR_DIR
  if (envDir) return envDir

  const candidates = [
    path.join(process.cwd(), "vendor", "openclaw", "extensions"),
    path.join(process.cwd(), "..", "vendor", "openclaw", "extensions"),
    path.join(__dirname, "..", "..", "..", "..", "vendor", "openclaw", "extensions"),
    path.join(__dirname, "..", "..", "..", "..", "..", "vendor", "openclaw", "extensions"),
  ]

  for (const c of candidates) {
    try { if (fs.statSync(c).isDirectory()) return c } catch { /* try next */ }
  }
  return candidates[0] // fallback
})()

interface PluginMeta {
  id: string
  name: string
  description: string
  version?: string
  channels?: string[]
  category: string
  requiresEnv?: string[]
}

function scanPlugins(): PluginMeta[] {
  const plugins: PluginMeta[] = []
  try {
    if (!fs.existsSync(VENDOR_DIR)) return plugins
    const dirs = fs.readdirSync(VENDOR_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())
    for (const dir of dirs) {
      const pluginDir = path.join(VENDOR_DIR, dir.name)
      const pkgPath = path.join(pluginDir, "package.json")
      const manifestPath = path.join(pluginDir, "openclaw.plugin.json")
      if (!fs.existsSync(pkgPath)) continue

      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"))
        const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {}
        const channels: string[] = manifest.channels ?? []
        const envVars: Record<string, string[]> = manifest.channelEnvVars ?? {}
        const requiredEnv = Object.values(envVars).flat() as string[]

        // Determine category
        let category = "utility"
        if (channels.length > 0) category = "channel"
        else if (pkg.name?.includes("provider") || manifest.provider) category = "provider"
        else if (dir.name.includes("memory") || dir.name.includes("search")) category = "memory"
        else if (dir.name.includes("speech") || dir.name.includes("tts")) category = "media"

        plugins.push({
          id: manifest.id ?? dir.name,
          name: pkg.name?.replace("@openclaw/", "") ?? dir.name,
          description: pkg.description ?? "",
          version: pkg.version,
          channels,
          category,
          requiresEnv: requiredEnv,
        })
      } catch { /* skip invalid plugin */ }
    }
  } catch { /* vendor dir not found */ }
  return plugins
}

function categorize(cat: string): string {
  const labels: Record<string, string> = { channel: "💬 Channel", provider: "🤖 Provider", memory: "🧠 Memory", media: "🎨 Media", utility: "🔧 Utility" }
  return labels[cat] ?? cat
}

export const MarketplaceParameters = Schema.Struct({
  filter: Schema.optional(Schema.String).annotate({ description: "Filter by name, category, or channel (e.g. 'telegram', 'channel', 'provider')" }),
})

export const PluginMarketplaceTool = Tool.define<typeof MarketplaceParameters, { count: number }, any>(
  "plugin_marketplace",
  Effect.gen(function* () {
    return {
      description: DESC,
      parameters: MarketplaceParameters,
      execute: (params: { filter?: string }, _ctx: Tool.Context) =>
        Effect.sync(() => {
          const all = scanPlugins()
          const filter = params.filter?.toLowerCase() ?? ""
          const filtered = filter
            ? all.filter((p) =>
                p.name.toLowerCase().includes(filter) ||
                p.id.toLowerCase().includes(filter) ||
                p.description.toLowerCase().includes(filter) ||
                p.category.includes(filter) ||
                p.channels?.some((c) => c.includes(filter)),
              )
            : all

          if (filtered.length === 0) {
            return {
              title: "Marketplace",
              metadata: { count: 0 },
              output: filter ? `No plugins matching "${params.filter}". Try: telegram, discord, channel, provider` : "No plugins found.",
            }
          }

          const groups: Record<string, PluginMeta[]> = {}
          for (const p of filtered) {
            groups[p.category] = groups[p.category] ?? []
            groups[p.category].push(p)
          }

          const lines = [`Marketplace: ${filtered.length} plugins available`, ""]
          for (const [cat, items] of Object.entries(groups)) {
            lines.push(`## ${categorize(cat)} (${items.length})`)
            for (const p of items.slice(0, 10)) {
              const channelTag = p.channels?.length ? ` [${p.channels.join(", ")}]` : ""
              const envTag = p.requiresEnv?.length ? ` needs: ${p.requiresEnv.join(", ")}` : ""
              lines.push(`  ${p.name}${channelTag}`)
              if (p.description) lines.push(`    ${p.description.slice(0, 120)}`)
              if (envTag) lines.push(`    ${envTag}`)
            }
            if (items.length > 10) lines.push(`  ... and ${items.length - 10} more`)
            lines.push("")
          }
          lines.push("Install with: plugin_install name=telegram")

          return {
            title: filter ? `Marketplace: ${params.filter}` : `Marketplace`,
            metadata: { count: filtered.length },
            output: lines.join("\n"),
          }
        }),
    }
  }),
)

// ═══ plugin_install ════════════════════════════════════════════════════════

export const InstallParameters = Schema.Struct({
  name: Schema.String.annotate({ description: "Plugin name (e.g. telegram, discord) or full URL to a plugin source" }),
})

export const PluginInstallTool = Tool.define<typeof InstallParameters, { plugin: string }, AppFileSystem.Service>(
  "plugin_install",
  Effect.gen(function* () {
    const afs = yield* AppFileSystem.Service
    return {
      description: "Install a plugin from the marketplace or from a URL. Plugins add messaging platforms, AI providers, tools, and automations.",
      parameters: InstallParameters,
      execute: (params: { name: string }, _ctx: Tool.Context) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const pluginsDir = path.join(instance.directory, ".agence", "plugins")
          const vendorPluginDir = path.join(VENDOR_DIR, params.name)

          if (fs.existsSync(vendorPluginDir)) {
            // Install from vendored marketplace
            const targetDir = path.join(pluginsDir, params.name)
            yield* Effect.sync(() => {
              if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })
              copyDirSync(vendorPluginDir, targetDir)
            })

            const pkg = JSON.parse(fs.readFileSync(path.join(vendorPluginDir, "package.json"), "utf8"))
            return {
              title: `Installed: ${params.name}`,
              metadata: { plugin: params.name },
              output: [
                `✅ Installed ${pkg.name ?? params.name} v${pkg.version ?? "?"}`,
                `  ${pkg.description ?? ""}`,
                `  From: vendor/plugins/${params.name}`,
                `  To: ${targetDir}`,
                "",
                "Available at next startup. Configure credentials in your provider/channel settings.",
              ].join("\n"),
            }
          }

          // Try as URL
          if (params.name.startsWith("http://") || params.name.startsWith("https://") || params.name.startsWith("github:")) {
            const url = params.name.replace(/^github:/, "https://github.com/")
            return {
              title: "Plugin Download",
              metadata: { plugin: params.name },
              output: `Download from URLs not yet implemented. Try a marketplace name like: telegram, discord, whatsapp, slack, signal, imessage, browser, cron`,
            }
          }

          // Search for close matches
          const all = scanPlugins()
          const match = all.find((p) => p.name.toLowerCase() === params.name.toLowerCase() || p.id.toLowerCase() === params.name.toLowerCase())
          const suggestions = match ? [match] : all.filter((p) =>
            p.name.toLowerCase().includes(params.name.toLowerCase()) ||
            p.id.toLowerCase().includes(params.name.toLowerCase()),
          ).slice(0, 5)

          if (suggestions.length > 0) {
            const list = suggestions.map((p) => `  ${p.name}: ${p.description.slice(0, 80)}`).join("\n")
            return {
              title: "Plugin Not Found",
              metadata: { plugin: params.name },
              output: [
                `Plugin "${params.name}" not found in marketplace.`,
                "",
                "Did you mean one of these?",
                list,
                "",
                "Install with: plugin_install name=telegram",
                "Browse with: plugin_marketplace",
              ].join("\n"),
            }
          }

          return {
            title: "Plugin Not Found",
            metadata: { plugin: params.name },
            output: `Plugin "${params.name}" not found. Run plugin_marketplace to browse available plugins.`,
          }
        }).pipe(Effect.orDie),
    }
  }),
)

function copyDirSync(src: string, dest: string) {
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true })
      copyDirSync(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}
