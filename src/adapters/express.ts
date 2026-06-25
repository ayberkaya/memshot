import type { Memory } from "../memory.js"

export interface MemshotRequest {
  memshot?: { text: string; tokensUsed: number }
  body?: unknown
  headers?: Record<string, string | string[] | undefined>
}

type MiddlewareOptions = {
  getPrompt?: (req: MiddlewareRequest) => string
  getSessionId?: (req: MiddlewareRequest) => string
}

type MiddlewareRequest = MemshotRequest & Record<string, unknown>

type NextFunction = (error?: unknown) => void

type Middleware = (req: MiddlewareRequest, res: unknown, next: NextFunction) => Promise<void>

function hasMessages(value: unknown): value is { messages: Array<{ content?: unknown }> } {
  return (
    typeof value === "object" &&
    value !== null &&
    "messages" in value &&
    Array.isArray((value as Record<string, unknown>).messages)
  )
}

function defaultPrompt(req: MiddlewareRequest): string {
  if (!hasMessages(req.body)) return ""
  const last = req.body.messages.at(-1)
  return typeof last?.content === "string" ? last.content : ""
}

function defaultSessionId(req: MiddlewareRequest): string {
  const raw = req.headers?.["x-session-id"]
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === "string" ? value : ""
}

export function memshotMiddleware(mem: Memory, options: MiddlewareOptions = {}): Middleware {
  const getPrompt = options.getPrompt ?? defaultPrompt
  const getSessionId = options.getSessionId ?? defaultSessionId

  return async (req, _res, next) => {
    try {
      const result = await mem.resolve(getPrompt(req), { sessionId: getSessionId(req) })
      req.memshot = { text: result.text, tokensUsed: result.tokensUsed }
      next()
    } catch (error) {
      next(error)
    }
  }
}
