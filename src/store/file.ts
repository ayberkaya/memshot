import { mkdir, readdir, readFile, rm, unlink, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { MemoryItem, Store } from "./index.js"

type SerializedTrigger = { source: string; flags: string }
type SerializedMemoryItem = Omit<MemoryItem, "triggers"> & { triggers?: SerializedTrigger[] }

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function serialize(item: MemoryItem): SerializedMemoryItem {
  const { triggers, ...rest } = item
  if (!triggers) return rest
  return { ...rest, triggers: triggers.map((trigger) => ({ source: trigger.source, flags: trigger.flags })) }
}

function deserialize(item: SerializedMemoryItem): MemoryItem {
  const { triggers, ...rest } = item
  if (!triggers || triggers.length === 0) return rest
  return { ...rest, triggers: triggers.map((trigger) => new RegExp(trigger.source, trigger.flags)) }
}

function pathFor(dir: string, id: string): string {
  return join(dir, `${id}.json`)
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true })
  } catch (error) {
    throw error instanceof Error ? error : new Error("Failed to create memory directory")
  }
}

export function fileStore(dir: string): Store {
  return {
    async add(item) {
      try {
        await ensureDir(dir)
        const stored = { ...item, id: createId() }
        await writeFile(pathFor(dir, stored.id), JSON.stringify(serialize(stored), null, 2), "utf8")
        return stored
      } catch (error) {
        throw error instanceof Error ? error : new Error("Failed to add memory")
      }
    },
    async get(id) {
      try {
        await ensureDir(dir)
        const raw = await readFile(pathFor(dir, id), "utf8").catch((error: unknown) => {
          if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined
          throw error
        })
        if (!raw) return undefined
        return deserialize(JSON.parse(raw) as SerializedMemoryItem)
      } catch (error) {
        throw error instanceof Error ? error : new Error("Failed to get memory")
      }
    },
    async list() {
      try {
        await ensureDir(dir)
        const files = (await readdir(dir)).filter((file) => file.endsWith(".json"))
        const items = await Promise.all(files.map(async (file) => {
          const raw = await readFile(join(dir, file), "utf8")
          return deserialize(JSON.parse(raw) as SerializedMemoryItem)
        }))
        return items
      } catch (error) {
        throw error instanceof Error ? error : new Error("Failed to list memories")
      }
    },
    async update(id, patch) {
      try {
        const current = await this.get(id)
        if (!current) throw new Error(`Memory not found: ${id}`)
        const updated = { ...current, ...patch, id }
        await writeFile(pathFor(dir, id), JSON.stringify(serialize(updated), null, 2), "utf8")
        return updated
      } catch (error) {
        throw error instanceof Error ? error : new Error("Failed to update memory")
      }
    },
    async delete(id) {
      try {
        await ensureDir(dir)
        await unlink(pathFor(dir, id)).catch((error: unknown) => {
          if (error instanceof Error && "code" in error && error.code === "ENOENT") return
          throw error
        })
      } catch (error) {
        throw error instanceof Error ? error : new Error("Failed to delete memory")
      }
    },
    async clear() {
      try {
        await rm(dir, { recursive: true, force: true })
        await ensureDir(dir)
      } catch (error) {
        throw error instanceof Error ? error : new Error("Failed to clear memories")
      }
    }
  }
}
