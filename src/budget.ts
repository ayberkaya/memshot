import type { Tokenizer } from "./tokenizer.js"
import type { MemoryItem } from "./store/index.js"

export interface ScoreBreakdown {
  bm25: number
  bm25Normalized: number
  frecency: number
  frecencyNormalized: number
  composite: number
}

export interface ScoredItem {
  item: MemoryItem
  score: number
  tokens: number
  breakdown?: ScoreBreakdown
}

export interface AllocationResult {
  selected: ScoredItem[]
  tokensUsed: number
  dropped: { warm: number; cold: number }
  excludedWarm: ScoredItem[]
  excludedCold: ScoredItem[]
}

interface AllocateParams {
  hot: ScoredItem[]
  warm: ScoredItem[]
  cold: ScoredItem[]
  budget: number
  tokenizer: Tokenizer
}

function ratio(item: ScoredItem): number {
  return item.tokens <= 0 ? item.score : item.score / item.tokens
}

function pickGreedy(items: ScoredItem[], budgetLeft: number): { selected: ScoredItem[]; tokens: number; excluded: ScoredItem[] } {
  const sorted = [...items].sort((left, right) => ratio(right) - ratio(left))
  const selected: ScoredItem[] = []
  const excluded: ScoredItem[] = []
  let tokens = 0

  for (const item of sorted) {
    if (tokens + item.tokens <= budgetLeft) {
      selected.push(item)
      tokens += item.tokens
    } else {
      excluded.push(item)
    }
  }

  return { selected, tokens, excluded }
}

export function allocate(params: AllocateParams): AllocationResult {
  void params.tokenizer
  const selected = [...params.hot]
  let tokensUsed = params.hot.reduce((total, item) => total + item.tokens, 0)

  if (tokensUsed > params.budget) console.warn("memshot hot memories exceed token budget")

  const warm = pickGreedy(params.warm, Math.max(0, params.budget - tokensUsed))
  selected.push(...warm.selected)
  tokensUsed += warm.tokens

  const cold = pickGreedy(params.cold, Math.max(0, params.budget - tokensUsed))
  selected.push(...cold.selected)
  tokensUsed += cold.tokens

  return {
    selected,
    tokensUsed,
    dropped: { warm: warm.excluded.length, cold: cold.excluded.length },
    excludedWarm: warm.excluded,
    excludedCold: cold.excluded
  }
}
