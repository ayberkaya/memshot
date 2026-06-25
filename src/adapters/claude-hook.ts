import type { Memory } from "../memory.js"

type ClaudePayload = { prompt?: unknown }

function parsePayload(input: string): ClaudePayload {
  const parsed: unknown = JSON.parse(input)
  if (typeof parsed === "object" && parsed !== null) return parsed
  return {}
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    process.stdin.on("data", (chunk: Buffer) => chunks.push(chunk))
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    process.stdin.on("error", reject)
  })
}

export function createClaudeHook(mem: Memory, options: { budget?: number; sessionEnvDir?: string } = {}): { run(): Promise<void> } {
  void options
  return {
    async run() {
      try {
        const payload = parsePayload(await readStdin())
        const prompt = typeof payload.prompt === "string" ? payload.prompt : ""
        const sessionId = process.env["CLAUDE_SESSION_ID"] ?? "default"
        const result = await mem.resolve(prompt, { sessionId })
        process.stdout.write(JSON.stringify({ additionalContext: result.text, tokensUsed: result.tokensUsed }))
      } catch (error) {
        throw error instanceof Error ? error : new Error("Failed to run Claude hook")
      }
    }
  }
}
