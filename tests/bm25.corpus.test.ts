import { describe, expect, it } from "vitest"
import { buildCorpus, scoreCorpus } from "../src/ranking/bm25.js"

describe("buildCorpus", () => {
  it("computes correct avgDocLength", () => {
    const corpus = buildCorpus(["hello world", "hello world foo bar baz"])
    // (2 + 5) / 2 = 3.5
    expect(corpus.avgDocLength).toBeCloseTo(3.5)
    expect(corpus.docCount).toBe(2)
  })

  it("computes document frequency correctly", () => {
    const corpus = buildCorpus(["hello world", "hello foo"])
    expect(corpus.df.get("hello")).toBe(2)
    expect(corpus.df.get("world")).toBe(1)
    expect(corpus.df.get("foo")).toBe(1)
  })

  it("computes per-doc term frequency", () => {
    const corpus = buildCorpus(["the the the cat"])
    expect(corpus.docs[0]?.tf.get("the")).toBe(3)
    expect(corpus.docs[0]?.tf.get("cat")).toBe(1)
  })

  it("handles empty input", () => {
    const corpus = buildCorpus([])
    expect(corpus.docCount).toBe(0)
    expect(corpus.docs).toHaveLength(0)
  })
})

describe("scoreCorpus", () => {
  it("returns empty array for empty corpus", () => {
    expect(scoreCorpus("query", buildCorpus([]))).toEqual([])
  })

  it("returns scores aligned with input documents", () => {
    const docs = ["typescript agent memory", "pizza recipe with cheese"]
    const corpus = buildCorpus(docs)
    const scores = scoreCorpus("typescript memory", corpus)
    expect(scores).toHaveLength(2)
    expect(scores[0]).toBeGreaterThan(scores[1] ?? 0)
  })

  it("is deterministic across repeated calls", () => {
    const docs = ["foo bar baz", "bar baz qux", "hello world"]
    const corpus = buildCorpus(docs)
    const a = scoreCorpus("bar", corpus)
    const b = scoreCorpus("bar", corpus)
    expect(a).toEqual(b)
  })

  it("length normalization — shorter doc with same TF scores strictly higher (FAILS on fake BM25)", () => {
    // Both docs have 'billing' exactly once. The short doc should score higher because
    // BM25 length normalization penalizes longer docs. Fake impl (avgdl=docLen) makes
    // docLen/avgdl=1 always → both docs score identically → test fails on fake impl.
    const shortDoc = "billing"
    const longDoc = `billing ${Array.from({ length: 20 }, (_, i) => `filler${i}`).join(" ")}`
    const corpus = buildCorpus([shortDoc, longDoc])
    const scores = scoreCorpus("billing", corpus)
    expect(scores[0]).toBeGreaterThan(scores[1] ?? 0)
  })

  it("corpus IDF — rare term query does not score docs without the term", () => {
    // 'common' is in every doc; 'rare' is only in doc 4.
    const docs = [
      "common word in every single document",
      "common word in every single document too",
      "common word here as well",
      "common word yes another one",
      "common word plus rare unique here"
    ]
    const corpus = buildCorpus(docs)
    const scores = scoreCorpus("rare unique", corpus)
    // Only doc 4 should score > 0
    expect(scores[4]).toBeGreaterThan(0)
    for (let i = 0; i < 4; i++) {
      expect(scores[i]).toBe(0)
    }
  })
})
