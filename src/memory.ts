import { allocate } from "./budget.js"
import type { ScoredItem } from "./budget.js"
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
}

type AddMemoryInput = Omit<MemoryItem, "id" | "createdAt" | "accessCount" | "lastAccessedAt">

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

  async add(item: AddMemoryInput): Promise<MemoryItem> {
    try {
      return await this.store.add({ ...item, createdAt: Date.now(), accessCount: 0, lastAccessedAt: 0 })
    } catch (error) {
      throw error instanceof Error ? error : new Error("Failed to add memory")
    }
  }

  async resolve(prompt: string, options: { sessionId?: string; now?: number }): Promise<ResolveResult> {
    try {
      const now = options.now ?? Date.now()
      const sessionId = options.sessionId ?? "default"
      const all = await this.store.list()
      const hot = this.scoreItems(resolveHot(all, sessionId, this.ledger))
      const warm = this.scoreItems(resolveWarm(all, prompt))
      const cold = resolveCold(all, prompt, now).map((item) => ({ ...item, tokens: this.tokenizer.count(item.item.content) }))
      const result = allocate({ hot, warm, cold, budget: this.budget, tokenizer: this.tokenizer })
      await this.touchColdItems(result.selected, now)
      return this.formatResult(result.selected, result.tokensUsed, result.dropped)
    } catch (error) {
      throw error instanceof Error ? error : new Error("Failed to resolve memories")
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

  private formatResult(selected: ScoredItem[], tokensUsed: number, dropped: { warm: number; cold: number }): ResolveResult {
    const items = selected.map((entry) => entry.item)
    const text = selected.map((entry) => `[MEMORY: ${entry.item.id}]\n${entry.item.content}\n`).join("\n")
    return { text, items, tokensUsed, dropped, tiersUsed: this.countTiers(items) }
  }

  private countTiers(items: MemoryItem[]): { hot: number; warm: number; cold: number } {
    return {
      hot: items.filter((item) => item.tier === "hot").length,
      warm: items.filter((item) => item.tier === "warm").length,
      cold: items.filter((item) => item.tier === "cold").length
    }
  }
}
