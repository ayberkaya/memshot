import type { Memory } from "../memory.js"

type MemshotContext = { memshot: { text: string; tokensUsed: number } }
type Handler = (req: unknown, ctx: MemshotContext) => Promise<Response>

type HeaderReader = { get(name: string): string | null }
type JsonRequest = { json(): Promise<unknown>; headers: HeaderReader }

function isJsonRequest(value: unknown): value is JsonRequest {
  return typeof value === "object" && value !== null
    && "json" in value && typeof value.json === "function"
    && "headers" in value && typeof value.headers === "object" && value.headers !== null
    && "get" in value.headers && typeof value.headers.get === "function"
}

function hasMessages(value: unknown): value is { messages: Array<{ content?: unknown }> } {
  return typeof value === "object" && value !== null && "messages" in value && Array.isArray(value.messages)
}

function promptFromPayload(payload: unknown): string {
  if (!hasMessages(payload)) return ""
  const last = payload.messages.at(-1)
  return typeof last?.content === "string" ? last.content : ""
}

export function withMemshot(mem: Memory, handler: Handler): (req: unknown) => Promise<Response> {
  return async (req) => {
    try {
      if (!isJsonRequest(req)) throw new Error("Invalid request")
      const payload = await req.json()
      const result = await mem.resolve(promptFromPayload(payload), { sessionId: req.headers.get("x-session-id") ?? "" })
      return await handler(req, { memshot: { text: result.text, tokensUsed: result.tokensUsed } })
    } catch (error) {
      throw error instanceof Error ? error : new Error("Failed to resolve memshot context")
    }
  }
}
