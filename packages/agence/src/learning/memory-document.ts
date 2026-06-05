import path from "path"
import TurndownService from "turndown"

const TEXT_EXTENSIONS = new Set([".md", ".markdown", ".txt", ".text", ".json", ".csv", ".log"])
const HTML_EXTENSIONS = new Set([".html", ".htm"])

export const SUPPORTED_MEMORY_IMPORT_EXTENSIONS = [
  ".md",
  ".markdown",
  ".txt",
  ".text",
  ".pdf",
  ".docx",
  ".html",
  ".htm",
] as const

export const MAX_MEMORY_IMPORT_BYTES = 12 * 1024 * 1024

export function memoryImportExtension(filename: string) {
  return path.extname(filename).toLowerCase()
}

export function isSupportedMemoryImport(filename: string) {
  const ext = memoryImportExtension(filename)
  return SUPPORTED_MEMORY_IMPORT_EXTENSIONS.includes(ext as (typeof SUPPORTED_MEMORY_IMPORT_EXTENSIONS)[number])
}

function htmlToText(html: string) {
  const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" })
  turndown.remove(["script", "style", "meta", "link"])
  return turndown.turndown(html)
}

export async function extractDocumentText(buffer: Uint8Array, filename: string): Promise<string> {
  const ext = memoryImportExtension(filename)

  if (TEXT_EXTENSIONS.has(ext)) return new TextDecoder("utf-8", { fatal: false }).decode(buffer).trim()

  if (HTML_EXTENSIONS.has(ext)) {
    const html = new TextDecoder("utf-8", { fatal: false }).decode(buffer)
    return htmlToText(html).trim()
  }

  if (ext === ".docx") {
    const mammoth = await import("mammoth")
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })
    return (result.value ?? "").trim()
  }

  if (ext === ".pdf") {
    const pdfParse = (await import("pdf-parse")).default as (data: Buffer) => Promise<{ text?: string }>
    const parsed = await pdfParse(Buffer.from(buffer))
    return (parsed.text ?? "").trim()
  }

  if (ext === ".doc") {
    throw new Error("Legacy .doc is not supported. Save as .docx or export to PDF from Word.")
  }

  throw new Error(
    `Unsupported file type "${ext || "(none)"}". Supported: ${SUPPORTED_MEMORY_IMPORT_EXTENSIONS.join(", ")}`,
  )
}
