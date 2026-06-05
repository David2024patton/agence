import { describe, expect, test } from "bun:test"
import { extractDocumentText, isSupportedMemoryImport } from "@/learning/memory-document"

describe("memory-document", () => {
  test("isSupportedMemoryImport accepts common types", () => {
    expect(isSupportedMemoryImport("notes.md")).toBe(true)
    expect(isSupportedMemoryImport("guide.PDF")).toBe(true)
    expect(isSupportedMemoryImport("legacy.doc")).toBe(false)
  })

  test("extractDocumentText reads utf-8 text files", async () => {
    const text = await extractDocumentText(new TextEncoder().encode("# Title\n\nBody"), "readme.md")
    expect(text).toContain("Title")
    expect(text).toContain("Body")
  })

  test("extractDocumentText rejects legacy doc", async () => {
    await expect(extractDocumentText(new Uint8Array([1, 2, 3]), "old.doc")).rejects.toThrow(/Legacy .doc/)
  })
})
