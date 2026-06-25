export type MemoryTier = "hot" | "warm" | "cold"

export interface MemoryItem {
  id: string
  content: string
  tier: MemoryTier
  tags?: string[]
  triggers?: RegExp[]
  once?: boolean
  createdAt: number
  accessCount: number
  lastAccessedAt: number
}

export interface Store {
  add(item: Omit<MemoryItem, "id">): Promise<MemoryItem>
  get(id: string): Promise<MemoryItem | undefined>
  list(): Promise<MemoryItem[]>
  update(id: string, patch: Partial<Omit<MemoryItem, "id">>): Promise<MemoryItem>
  delete(id: string): Promise<void>
  clear(): Promise<void>
}
