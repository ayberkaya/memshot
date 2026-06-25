import { describe, expect, it } from "vitest"
import { Memory, memoryStore } from "../src/index.js"

describe("Memory e2e", () => {
  it("budget not exceeded", async () => {
    const mem = new Memory({ budget: 100, store: memoryStore() })
    for (let index = 0; index < 20; index += 1) await mem.add({ tier: "cold", content: "word ".repeat(20) })
    const result = await mem.resolve("query", { sessionId: "s1" })
    expect(result.tokensUsed).toBeLessThanOrEqual(100)
  })

  it("once:true hot item injected once per session", async () => {
    const mem = new Memory({ budget: 10000, store: memoryStore() })
    await mem.add({ tier: "hot", content: "SECRET_ONCE", once: true })
    const r1 = await mem.resolve("query", { sessionId: "s1" })
    const r2 = await mem.resolve("query", { sessionId: "s1" })
    expect(r1.text).toContain("SECRET_ONCE")
    expect(r2.text).not.toContain("SECRET_ONCE")
  })

  it("warm trigger matching", async () => {
    const mem = new Memory({ budget: 10000, store: memoryStore() })
    await mem.add({ tier: "warm", content: "TS_FACT", triggers: [/typescript/i] })
    const r1 = await mem.resolve("TypeScript project", { sessionId: "s1" })
    const r2 = await mem.resolve("python project", { sessionId: "s2" })
    expect(r1.text).toContain("TS_FACT")
    expect(r2.text).not.toContain("TS_FACT")
  })

  it("cold items ranked by score", async () => {
    const mem = new Memory({ budget: 200, store: memoryStore() })
    const low = await mem.add({ tier: "cold", content: "LOW_ACCESS item" })
    const high = await mem.add({ tier: "cold", content: "HIGH_ACCESS item" })
    await mem.store.update(high.id, { accessCount: 10, lastAccessedAt: Date.now() })
    const result = await mem.resolve("item", { sessionId: "s1" })
    const ids = result.items.map((item) => item.id)
    expect(ids.indexOf(high.id)).toBeLessThan(ids.indexOf(low.id))
  })
})
