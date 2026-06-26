import type { ScoredItem, ScoreBreakdown } from "./budget.js"
import type { MemoryTier } from "./store/index.js"

export interface MemoryTraceEntry {
  id: string
  tier: MemoryTier
  included: boolean
  reason: string
  tokens: number
  scores?: ScoreBreakdown
}

export interface ResolveTrace {
  budget: number
  tokensUsed: number
  entries: MemoryTraceEntry[]
}

interface TraceInput {
  selected: ScoredItem[]
  tokensUsed: number
  excludedWarm: ScoredItem[]
  excludedCold: ScoredItem[]
}

export function buildTrace(allocation: TraceInput, budget: number): ResolveTrace {
  const entries: MemoryTraceEntry[] = []

  for (const item of allocation.selected) {
    if (item.item.tier === "hot") {
      entries.push({ id: item.item.id, tier: "hot", included: true, reason: "always injected", tokens: item.tokens })
    } else if (item.item.tier === "warm") {
      entries.push({ id: item.item.id, tier: "warm", included: true, reason: "trigger matched, fit budget", tokens: item.tokens })
    } else {
      const composite = item.breakdown?.composite.toFixed(3) ?? item.score.toFixed(3)
      entries.push({
        id: item.item.id,
        tier: "cold",
        included: true,
        reason: `composite ${composite}, fit under budget`,
        tokens: item.tokens,
        ...(item.breakdown && { scores: item.breakdown })
      })
    }
  }

  for (const item of allocation.excludedWarm) {
    entries.push({ id: item.item.id, tier: "warm", included: false, reason: "exceeded remaining budget", tokens: item.tokens })
  }

  for (const item of allocation.excludedCold) {
    const composite = item.breakdown?.composite.toFixed(3) ?? item.score.toFixed(3)
    entries.push({
      id: item.item.id,
      tier: "cold",
      included: false,
      reason: `composite ${composite}, exceeded remaining budget`,
      tokens: item.tokens,
      ...(item.breakdown && { scores: item.breakdown })
    })
  }

  return { budget, tokensUsed: allocation.tokensUsed, entries }
}
