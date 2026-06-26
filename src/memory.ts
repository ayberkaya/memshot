import { allocate } from "./budget.js"
import type { ScoredItem } from "./budget.js"
import { buildTrace } from "./explain.js"
import type { ResolveTrace } from "./explain.js"
import { jaccard } from "./ranking/similarity.js"
import { inMemoryLedger } from "./session.js"
import type { SessionLedger } from "./session.js"
import type { MemoryItem, Store } from "./store/index.js"
import { defaultTokenizer } from "./tokenizer.js"
import type { Tokenizer } from "./tokenizer.js"
import { resolveCold, resolveHot, resolveWarm } from "./tiers.js"

export interface MemoryConfig {
  budget: number
  store: Store
  tokenizer?: Tokenizer
  ledger?: SessionLedger
}

export interface ResolveResult {
  text: string
  items: MemoryItem[]
  tokensUsed: number
  tiersUsed: { hot: number; warm: number; cold: number }
  dropped: { warm: number; cold: number }
  trace?: ResolveTrace
}

export interface MemoryStats {
  total: number
  byTier: { hot: number; warm: number; cold: number }
  tokens: { total: number; byTier: { hot: number; warm: number; cold: number }; average: number }
  oldest?: { id: string; createdAt: number }
  newest?: { id: string; createdAt: number }
  cold?: { totalAccesses: number; averageAccessCount: number }
}

export interface DedupeOptions {
  threshold?: number
  strategy?: "skip" | "update"
  scope?: "same-tier" | "all"
}

export type UpdatePatch = Partial<Pick<MemoryItem, "content" | "tier" | "tags" | "triggers" | "once">>

type AddMemoryInput = Omit<MemoryItem, "id" | "createdAt" | "accessCount" | "lastAccessedAt">
type AddOptions = { dedupe?: boolean | DedupeOptions }

export class Memory {
  public readonly budget: number
  public readonly store: Store
  private readonly tokenizer: Tokenizer
  private readonly ledger: SessionLedger

  constructor(config: MemoryConfig) {
    this.budget = config.budget
    this.store = config.store
    this.tokenizer = config.tokenizer ?? defaultTokenizer()
    this.ledger = config.ledger ?? inMemoryLedger()
  }

  async add(item: AddMemoryInput, opts?: AddOptions): Promise<MemoryItem> {
    try {
      if (opts?.dedupe) {
        const dedupeOpts: DedupeOptions = typeof opts.dedupe === "boolean" ? {} : opts.dedupe
        const threshold = dedupeOpts.threshold ?? 0.85
        const strategy = dedupeOpts.strategy ?? "skip"
        const scope = dedupeOpts.scope ?? "same-tier"
        const all = await this.store.list()
        const candidates = scope === "same-tier" ? all.filter((i) => i.tier === item.tier) : all
        let bestMatch: MemoryItem | undefined
        let bestScore = 0
        for (const candidate of candidates) {
          const score = jaccard(item.content, candidate.content)
          if (score > bestScore) { bestScore = score; bestMatch = candidate }
        }
        if (bestMatch && bestScore >= threshold) {
          if (strategy === "skip") return bestMatch
          return await this.store.update(bestMatch.id, { content: item.content })
        }
      }
      return await this.store.add({ ...item, createdAt: Date.now(), accessCount: 0, lastAccessedAt: 0 })
    } catch (error) {
      throw error instanceof Error ? error : new Error("Failed to add memory")
    }
  }

  async resolve(prompt: string, options: { sessionId?: string; now?: number; trace?: boolean } = {}): Promise<ResolveResult> {
    try {
      const now = options.now ?? Date.now()
      const sessionId = options.sessionId ?? "default"
      const all = await this.store.list()
      const hot = this.scoreItems(resolveHot(all, sessionId, this.ledger))
      const warm = this.scoreItems(resolveWarm(all, prompt))
      const cold = resolveCold(all, prompt, now).map((item) => ({ ...item, tokens: this.tokenizer.count(item.item.content) }))
      const result = allocate({ hot, warm, cold, budget: this.budget, tokenizer: this.tokenizer })
      await this.touchColdItems(result.selected, now)
      const trace = options.trace ? buildTrace(result, this.budget) : undefined
      return this.formatResult(result.selected, result.tokensUsed, result.dropped, trace)
    } catch (error) {
      throw error instanceof Error ? error : new Error("Failed to resolve memories")
    }
  }

  async update(id: string, patch: UpdatePatch): Promise<MemoryItem> {
    try {
      return await this.store.update(id, patch)
    } catch (error) {
      throw error instanceof Error ? error : new Error("Failed to update memory")
    }
  }

  async stats(): Promise<MemoryStats> {
    try {
      const all = await this.store.list()
      const hot = all.filter((i) => i.tier === "hot")
      const warm = all.filter((i) => i.tier === "warm")
      const cold = all.filter((i) => i.tier === "cold")

      const count = (items: MemoryItem[]) => items.reduce((sum, i) => sum + this.tokenizer.count(i.content), 0)
      const totalTokens = count(all)
      const hotTokens = count(hot)
      const warmTokens = count(warm)
      const coldTokens = count(cold)

      const sorted = [...all].sort((a, b) => a.createdAt - b.createdAt)
      const oldest = sorted[0] ? { id: sorted[0].id, createdAt: sorted[0].createdAt } : undefined
      const newest = sorted.at(-1) ? { id: sorted.at(-1)!.id, createdAt: sorted.at(-1)!.createdAt } : undefined

      const coldStats = cold.length > 0
        ? {
          totalAccesses: cold.reduce((sum, i) => sum + i.accessCount, 0),
          averageAccessCount: cold.reduce((sum, i) => sum + i.accessCount, 0) / cold.length
        }
        : undefined

      return {
        total: all.length,
        byTier: { hot: hot.length, warm: warm.length, cold: cold.length },
        tokens: {
          total: totalTokens,
          byTier: { hot: hotTokens, warm: warmTokens, cold: coldTokens },
          average: all.length > 0 ? totalTokens / all.length : 0
        },
        ...(oldest && { oldest }),
        ...(newest && { newest }),
        ...(coldStats && { cold: coldStats })
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error("Failed to get memory stats")
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.store.delete(id)
    } catch (error) {
      throw error instanceof Error ? error : new Error("Failed to delete memory")
    }
  }

  async clear(): Promise<void> {
    try {
      await this.store.clear()
    } catch (error) {
      throw error instanceof Error ? error : new Error("Failed to clear memories")
    }
  }

  private scoreItems(items: MemoryItem[]): ScoredItem[] {
    return items.map((item) => ({ item, score: 1, tokens: this.tokenizer.count(item.content) }))
  }

  private async touchColdItems(items: ScoredItem[], now: number): Promise<void> {
    try {
      const coldItems = items.filter((entry) => entry.item.tier === "cold")
      await Promise.all(coldItems.map((entry) => this.store.update(entry.item.id, {
        accessCount: entry.item.accessCount + 1,
        lastAccessedAt: now
      })))
    } catch (error) {
      throw error instanceof Error ? error : new Error("Failed to update cold memories")
    }
  }

  private formatResult(selected: ScoredItem[], tokensUsed: number, dropped: { warm: number; cold: number }, trace?: ResolveTrace): ResolveResult {
    const items = selected.map((entry) => entry.item)
    const text = selected.map((entry) => `[MEMORY: ${entry.item.id}]\n${entry.item.content}\n`).join("\n")
    const result: ResolveResult = { text, items, tokensUsed, dropped, tiersUsed: this.countTiers(items) }
    if (trace !== undefined) result.trace = trace
    return result
  }

  private countTiers(items: MemoryItem[]): { hot: number; warm: number; cold: number } {
    return {
      hot: items.filter((item) => item.tier === "hot").length,
      warm: items.filter((item) => item.tier === "warm").length,
      cold: items.filter((item) => item.tier === "cold").length
    }
  }
}
