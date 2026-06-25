import { describe, expect, it } from "vitest"
import { frecencyScore } from "../src/ranking/frecency.js"

describe("frecencyScore", () => {
  it("high access + recent > low access + old", () => {
    const now = Date.now()
    const high = frecencyScore({ accessCount: 10, lastAccessedAt: now - 1000, createdAt: now - 100000, now })
    const low = frecencyScore({ accessCount: 1, lastAccessedAt: now - 3600000 * 24, createdAt: now - 100000, now })
    expect(high).toBeGreaterThan(low)
  })

  it("zero access lastAccessedAt=0 returns >=0", () => {
    expect(frecencyScore({ accessCount: 0, lastAccessedAt: 0, createdAt: Date.now() - 1000, now: Date.now() })).toBeGreaterThanOrEqual(0)
  })
})
