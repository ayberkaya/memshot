import { describe, expect, it } from "vitest"
import { inMemoryLedger } from "../src/session.js"

describe("SessionLedger", () => {
  it("new session + new item has false", () => {
    expect(inMemoryLedger().has("s1", "i1")).toBe(false)
  })

  it("after mark has true", () => {
    const ledger = inMemoryLedger()
    ledger.mark("s1", "i1")
    expect(ledger.has("s1", "i1")).toBe(true)
  })

  it("after clear has false", () => {
    const ledger = inMemoryLedger()
    ledger.mark("s1", "i1")
    ledger.clear("s1")
    expect(ledger.has("s1", "i1")).toBe(false)
  })

  it("different sessionId isolated", () => {
    const ledger = inMemoryLedger()
    ledger.mark("s1", "i1")
    expect(ledger.has("s2", "i1")).toBe(false)
  })
})
