import { describe, expect, it } from "vitest"
import { bm25Score } from "../src/ranking/bm25.js"

describe("bm25Score", () => {
  it("relevant doc scores high", () => {
    expect(bm25Score("typescript memory agent", "TypeScript-native memory management for LLM agents")).toBeGreaterThan(0)
  })

  it("irrelevant doc scores lower", () => {
    const relevant = bm25Score("typescript agent", "TypeScript agent framework")
    const irrelevant = bm25Score("typescript agent", "pizza recipe with tomatoes")
    expect(relevant).toBeGreaterThan(irrelevant)
  })

  it("empty query returns 0", () => {
    expect(bm25Score("", "some document")).toBe(0)
  })
})
