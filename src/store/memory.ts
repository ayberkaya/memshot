import type { MemoryItem, Store } from "./index.js"

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function memoryStore(): Store {
  const items = new Map<string, MemoryItem>()

  return {
    async add(item) {
      try {
        const stored = { ...item, id: createId() }
        items.set(stored.id, stored)
        return stored
      } catch (error) {
        throw error instanceof Error ? error : new Error("Failed to add memory")
      }
    },
    async get(id) {
      try {
        return items.get(id)
      } catch (error) {
        throw error instanceof Error ? error : new Error("Failed to get memory")
      }
    },
    async list() {
      try {
        return Array.from(items.values())
      } catch (error) {
        throw error instanceof Error ? error : new Error("Failed to list memories")
      }
    },
    async update(id, patch) {
      try {
        const current = items.get(id)
        if (!current) throw new Error(`Memory not found: ${id}`)
        const updated = { ...current, ...patch, id }
        items.set(id, updated)
        return updated
      } catch (error) {
        throw error instanceof Error ? error : new Error("Failed to update memory")
      }
    },
    async delete(id) {
      try {
        items.delete(id)
      } catch (error) {
        throw error instanceof Error ? error : new Error("Failed to delete memory")
      }
    },
    async clear() {
      try {
        items.clear()
      } catch (error) {
        throw error instanceof Error ? error : new Error("Failed to clear memories")
      }
    }
  }
}
