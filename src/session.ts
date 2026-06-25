export interface SessionLedger {
  has(sessionId: string, itemId: string): boolean
  mark(sessionId: string, itemId: string): void
  clear(sessionId: string): void
}

export function inMemoryLedger(): SessionLedger {
  const sessions = new Map<string, Set<string>>()

  return {
    has(sessionId, itemId) {
      return sessions.get(sessionId)?.has(itemId) ?? false
    },
    mark(sessionId, itemId) {
      const items = sessions.get(sessionId) ?? new Set<string>()
      items.add(itemId)
      sessions.set(sessionId, items)
    },
    clear(sessionId) {
      sessions.delete(sessionId)
    }
  }
}
