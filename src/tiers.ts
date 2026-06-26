import type { ScoredItem } from "./budget.js"
import { buildCorpus, scoreCorpus } from "./ranking/bm25.js"
import { frecencyScore } from "./ranking/frecency.js"
import type { SessionLedger } from "./session.js"
import type { MemoryItem } from "./store/index.js"

function normalize(scores: number[]): number[] {
  const max = Math.max(...scores, 0)
  if (max === 0) return scores.map(() => 0)
  return scores.map((score) => score / max)
}

function matchesPrompt(trigger: RegExp, prompt: string): boolean {
  trigger.lastIndex = 0
  return trigger.test(prompt)
}

export function resolveHot(items: MemoryItem[], sessionId: string, ledger: SessionLedger): MemoryItem[] {
  const hot: MemoryItem[] = []

  for (const item of items) {
    if (item.tier !== "hot") continue
    if (item.once !== true) {
      hot.push(item)
      continue
    }
    if (ledger.has(sessionId, item.id)) continue
    ledger.mark(sessionId, item.id)
    hot.push(item)
  }

  return hot
}

export function resolveWarm(items: MemoryItem[], prompt: string): MemoryItem[] {
  return items.filter((item) => {
    if (item.tier !== "warm") return false
    if (!item.triggers || item.triggers.length === 0) return true
    return item.triggers.some((trigger) => matchesPrompt(trigger, prompt))
  })
}

export function resolveCold(items: MemoryItem[], query: string, now: number): ScoredItem[] {
  const cold = items.filter((item) => item.tier === "cold")
  const corpus = buildCorpus(cold.map((item) => item.content))
  const bm25Scores = scoreCorpus(query, corpus)
  const frecencyScores = cold.map((item) => frecencyScore({
    accessCount: item.accessCount,
    lastAccessedAt: item.lastAccessedAt,
    createdAt: item.createdAt,
    now
  }))
  const normalizedBm25 = normalize(bm25Scores)
  const normalizedFrecency = normalize(frecencyScores)

  return cold
    .map((item, index) => {
      const bm25 = bm25Scores[index] ?? 0
      const bm25Normalized = normalizedBm25[index] ?? 0
      const frecency = frecencyScores[index] ?? 0
      const frecencyNormalized = normalizedFrecency[index] ?? 0
      const composite = 0.6 * bm25Normalized + 0.4 * frecencyNormalized
      return {
        item,
        score: composite,
        tokens: 0,
        breakdown: { bm25, bm25Normalized, frecency, frecencyNormalized, composite }
      }
    })
    .sort((left, right) => right.score - left.score)
}
