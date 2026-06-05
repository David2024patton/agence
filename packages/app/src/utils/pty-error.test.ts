import { describe, expect, test } from "bun:test"
import { isPtyNotFoundError } from "./pty-error"

describe("isPtyNotFoundError", () => {
  test("matches message text", () => {
    expect(isPtyNotFoundError(new Error("PTY session not found: pty_abc"))).toBe(true)
    expect(isPtyNotFoundError(new Error("PtyNotFound"))).toBe(true)
    expect(isPtyNotFoundError(new Error("network down"))).toBe(false)
  })

  test("matches 404 status objects", () => {
    expect(isPtyNotFoundError({ status: 404, message: "missing" })).toBe(true)
    expect(isPtyNotFoundError({ status: 500, message: "PTY session not found" })).toBe(false)
  })
})
