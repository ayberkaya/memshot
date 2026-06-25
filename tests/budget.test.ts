import { describe, expect, it } from "vitest"
import { allocate } from "../src/budget.js"
import { defaultTokenizer } from "../src/tokenizer.js"
import type { ScoredItem } from "../src/budget.js"
import type { MemoryItem } from "../src/store/index.js"

function makeItem(id: string, content: string, tier: "hot" | "warm" | "cold", score: number): ScoredItem {
  const item: MemoryItem = { id, content, tier, createdAt: Date.now(), accessCount: 0, lastAccessedAt: 0 }
  const tokenizer = defaultTokenizer()
  return { item, score, tokens: tokenizer.count(content) }
}

describe("allocate", () => {
  it("does not exceed budget", () => {
    const cold = Array.from({ length: 10 }, (_, index) => makeItem(`c${index}`, "a".repeat(200), "cold", index))
    const { tokensUsed } = allocate({ hot: [], warm: [], cold, budget: 100, tokenizer: defaultTokenizer() })
    expect(tokensUsed).toBeLessThanOrEqual(100)
  })

  it("hot always included", () => {
    const hot = [makeItem("h1", "a".repeat(800), "hot", 1)]
    const { selected } = allocate({ hot, warm: [], cold: [], budget: 100, tokenizer: defaultTokenizer() })
    expect(selected.some((item) => item.item.id === "h1")).toBe(true)
  })

  it("cold selected by score/token ratio", () => {
    const tokenizer = defaultTokenizer()
    const c1: ScoredItem = { item: { id: "c1", content: "x", tier: "cold", createdAt: 0, accessCount: 0, lastAccessedAt: 0 }, score: 10, tokens: tokenizer.count("x") }
    const c2: ScoredItem = { item: { id: "c2", content: "a".repeat(400), tier: "cold", createdAt: 0, accessCount: 0, lastAccessedAt: 0 }, score: 1, tokens: tokenizer.count("a".repeat(400)) }
    const { selected } = allocate({ hot: [], warm: [], cold: [c1, c2], budget: 50, tokenizer })
    expect(selected.some((item) => item.item.id === "c1")).toBe(true)
  })

  it("dropped count correct", () => {
    const warm = Array.from({ length: 5 }, (_, index) => makeItem(`w${index}`, "word ".repeat(10), "warm", 1))
    const { dropped } = allocate({ hot: [], warm, cold: [], budget: 1, tokenizer: defaultTokenizer() })
    expect(dropped.warm).toBe(5)
  })
})
