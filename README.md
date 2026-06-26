# memshot

[![npm version](https://img.shields.io/npm/v/%40ayberkaya%2Fmemshot)](https://www.npmjs.com/package/@ayberkaya/memshot)
[![license](https://img.shields.io/npm/l/%40ayberkaya%2Fmemshot)](./LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/%40ayberkaya%2Fmemshot)](https://bundlephobia.com/package/@ayberkaya/memshot)

**Your agent's memory shouldn't cost 15,000 tokens before the user says hello.**

memshot is a tiered, token-budget-aware memory library for LLM agents. Zero runtime dependencies. No vector DB. No server. Works anywhere JavaScript runs — Node, Deno, Bun, edge functions, the browser.

---

## The problem

Most memory libraries have no selection layer. Inject everything on every call. At 500 stored memories:

```
naive injection:
████████████████████████████████████████████████  36,552 tokens
                                                  ^^^^^^^^^^^^^^^^^^
                                           9.1× your context budget
```

The signal-to-noise ratio collapses. Relevant context drowns in noise.

## How memshot fixes it

```
memshot (4000-token budget):
████  3,957 tokens  (62 items selected from 500)
      ↑ only what's relevant to this prompt
```

memshot selects which memories to inject using three tiers:

```
┌─────────────────────────────────────────────────────────────────────┐
│  prompt: "we discussed billing last week, what did we decide?"      │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
         ┌────────────▼────────────┐
         │       hot tier          │  always injected (once:true = once/session)
         │  "User's name is Ayberk"│
         └────────────┬────────────┘
                      │
         ┌────────────▼────────────┐
         │       warm tier         │  injected when triggers regex matches prompt
         │  billing/pricing rules  │  ← /billing|pricing/i matched
         └────────────┬────────────┘
                      │
         ┌────────────▼────────────┐
         │       cold tier         │  corpus BM25 + frecency → greedy knapsack
         │  top-N relevant history │  until budget exhausted
         └────────────┬────────────┘
                      │
         ┌────────────▼────────────┐
         │    4000-token budget    │
         │    injected to LLM      │
         └─────────────────────────┘
```

| Tier | Selection | Use for |
|------|-----------|---------|
| **hot** | Always included. `once: true` injects once per `sessionId`. | Identity, system facts, permanent instructions |
| **warm** | Included when any `triggers` regex matches the prompt. No triggers = always warm. | Domain knowledge, project context |
| **cold** | Corpus-aware BM25 keyword relevance + frecency decay, selected greedily by score/token ratio. | Conversation history, decisions, event log |

---

## Install

```bash
npm install @ayberkaya/memshot
# or: bun add @ayberkaya/memshot
# or: npx memshot   (CLI, no install required)
```

Zero runtime dependencies. Optional: `npm install gpt-tokenizer` for exact token counts.

---

## Quickstart

```ts
import { Memory, fileStore } from "@ayberkaya/memshot"

const mem = new Memory({ budget: 4000, store: fileStore("./memories") })

// Add memories to tiers
await mem.add({ content: "User's name is Ayberk. Prefers TypeScript.", tier: "hot" })
await mem.add({ content: "Billing: ship Stripe subscriptions first, add metering later.", tier: "warm", triggers: [/billing|pricing/i] })
await mem.add({ content: "Meeting 2026-06-20: decided to delay enterprise tier until Q3.", tier: "cold" })

// Resolve against the current prompt — returns only what fits in budget
const { text, tokensUsed, tiersUsed } = await mem.resolve(userPrompt, { sessionId: "abc123" })

// Prepend to your system prompt
const response = await openai.chat.completions.create({
  messages: [
    { role: "system", content: `${text}\n\n${yourSystemPrompt}` },
    { role: "user", content: userPrompt }
  ]
})
```

`fileStore` persists to disk as JSON files. For in-process use, tests, and edge functions: swap in `memoryStore()`.

---

## Benchmark

500 memories (5 hot, 45 warm, 450 cold), 4000-token budget, billing-related prompt:

```
memshot benchmark — 500 memories, 4000-token budget (gpt-tokenizer cl100k)
─────────────────────────────────────────────────
               naive   memshot   savings
items            500        62    -87.6%
tokens used   36,552     3,957    -89.2%
─────────────────────────────────────────────────
reproduce: npm run benchmark
```

Run it yourself:

```bash
git clone https://github.com/ayberkaya/memshot
cd memshot && npm install
npm run benchmark
```

---

## API Reference

### `new Memory(config)`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `budget` | `number` | yes | — | Max tokens to inject per `resolve` call |
| `store` | `Store` | yes | — | `fileStore(dir)` or `memoryStore()` |
| `tokenizer` | `Tokenizer` | no | heuristic | Plug in `gpt-tokenizer` for exact counts |
| `ledger` | `SessionLedger` | no | in-memory | Tracks `once: true` per session |

### `mem.add(item, opts?)`

```ts
await mem.add({ content, tier, triggers?, once?, tags? })

// Dedup: skip if near-duplicate already exists (Jaccard ≥ 0.85)
await mem.add({ content, tier }, { dedupe: true })
await mem.add({ content, tier }, { dedupe: { threshold: 0.9, strategy: "update", scope: "all" } })
```

| Field | Type | Description |
|-------|------|-------------|
| `content` | `string` | Text to store |
| `tier` | `"hot" \| "warm" \| "cold"` | Selection tier |
| `triggers` | `RegExp[]` | Warm: inject when one of these matches the prompt |
| `once` | `boolean` | Hot: inject only once per `sessionId` |
| `tags` | `string[]` | Arbitrary labels on retrieved items |

### `mem.resolve(prompt, opts?)`

```ts
const result = await mem.resolve(prompt, {
  sessionId?: string,
  now?: number,       // override Date.now() for tests
  trace?: boolean     // include per-item score breakdown
})
```

Returns `ResolveResult`:

| Field | Type | Description |
|-------|------|-------------|
| `text` | `string` | Ready-to-inject block; prepend to system prompt |
| `items` | `MemoryItem[]` | Selected items in tier order |
| `tokensUsed` | `number` | Total tokens consumed |
| `tiersUsed` | `{ hot, warm, cold: number }` | Items per tier |
| `dropped` | `{ warm, cold: number }` | Items excluded by budget |
| `trace?` | `ResolveTrace` | Per-item breakdown (only when `trace: true`) |

### `mem.resolve` with trace

```ts
const { trace } = await mem.resolve(prompt, { trace: true })

for (const entry of trace.entries) {
  console.log(entry.tier, entry.included ? "✓" : "✗", entry.reason)
  if (entry.scores) {
    console.log("  bm25:", entry.scores.bm25Normalized.toFixed(3),
                "frecency:", entry.scores.frecencyNormalized.toFixed(3),
                "composite:", entry.scores.composite.toFixed(3))
  }
}
```

Trace scope: items that entered budget allocation (all included + budget-dropped). Items filtered before scoring (unseen `once:true` hot, trigger-miss warm) are not yet traced.

### `mem.stats()`

```ts
const stats = await mem.stats()
// {
//   total: 500,
//   byTier: { hot: 5, warm: 45, cold: 450 },
//   tokens: { total: 52000, byTier: {...}, average: 104 },
//   oldest: { id: "...", createdAt: 1719000000000 },
//   newest: { id: "...", createdAt: 1719400000000 },
//   cold: { totalAccesses: 1230, averageAccessCount: 2.7 }
// }
```

### `mem.update(id, patch)`

```ts
await mem.update(id, { content: "Updated decision: defer until Q4." })
await mem.update(id, { tier: "hot", once: true })
```

Patchable fields: `content`, `tier`, `tags`, `triggers`, `once`. Engine-managed fields (`createdAt`, `accessCount`, `lastAccessedAt`) are excluded to preserve frecency integrity.

### `mem.delete(id)` / `mem.clear()`

```ts
await mem.delete(itemId)
await mem.clear()
```

---

## CLI

```bash
npx memshot add "User prefers concise answers." --tier hot
npx memshot add "Billing rules: ..." --tier warm --trigger "/billing/i"
npx memshot list
npx memshot resolve "what are the billing rules?" --budget 4000 --trace
npx memshot stats
npx memshot delete <id>
npx memshot clear
```

`--trace` prints a table with id, tier, ✓/✗, tokens, composite score, and reason for every considered item.

Persistence: `MEMSHOT_DIR` env var (default `./.memshot`).

---

## Integration recipes

### OpenAI

```ts
import OpenAI from "openai"
import { Memory, fileStore } from "@ayberkaya/memshot"

const mem = new Memory({ budget: 4000, store: fileStore("./memories") })
const openai = new OpenAI()

async function chat(userMessage: string, sessionId: string) {
  const { text } = await mem.resolve(userMessage, { sessionId })
  return openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: `${text}\n\nYou are a helpful assistant.` },
      { role: "user", content: userMessage }
    ]
  })
}
```

### Anthropic

```ts
import Anthropic from "@anthropic-ai/sdk"
import { Memory, fileStore } from "@ayberkaya/memshot"

const mem = new Memory({ budget: 4000, store: fileStore("./memories") })
const anthropic = new Anthropic()

async function chat(userMessage: string, sessionId: string) {
  const { text } = await mem.resolve(userMessage, { sessionId })
  return anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `${text}\n\nYou are a helpful assistant.`,
    messages: [{ role: "user", content: userMessage }]
  })
}
```

### LangChain

```ts
import { ChatOpenAI } from "@langchain/openai"
import { SystemMessage, HumanMessage } from "@langchain/core/messages"
import { Memory, fileStore } from "@ayberkaya/memshot"

const mem = new Memory({ budget: 4000, store: fileStore("./memories") })
const model = new ChatOpenAI({ model: "gpt-4o" })

async function chat(userMessage: string, sessionId: string) {
  const { text } = await mem.resolve(userMessage, { sessionId })
  return model.invoke([
    new SystemMessage(`${text}\n\nYou are a helpful assistant.`),
    new HumanMessage(userMessage)
  ])
}
```

---

## Adapters

### Express

```ts
import { memshotMiddleware } from "@ayberkaya/memshot/adapters/express"

app.use(memshotMiddleware(mem, {
  getPrompt: (req) => req.body.messages.at(-1)?.content ?? "",
  getSessionId: (req) => req.headers["x-session-id"] ?? ""
}))

app.post("/chat", (req, res) => {
  const { text } = req.memshot  // already resolved
  // use text as system prompt prefix
})
```

### Next.js route handler

```ts
import { withMemshot } from "@ayberkaya/memshot/adapters/next"

export const POST = withMemshot(mem, async (req, { memshot }) => {
  const systemPrefix = memshot.text
  return Response.json({ ok: true })
})
```

### Claude Code hook (UserPromptSubmit)

```ts
import { createClaudeHook } from "@ayberkaya/memshot/adapters/claude-hook"

const hook = createClaudeHook(mem)
await hook.run()
```

Register in `.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "type": "command", "command": "node ./hooks/memory.js" }
    ]
  }
}
```

---

## Why not X?

This table is honest. "~" means partial or depends on configuration.

| | **memshot** | **mem0** | **basic-memory** | **Zep** |
|---|---|---|---|---|
| Zero runtime deps | ✓ | ✗ | ✗ | ✗ |
| Token-budget-aware | ✓ | ✗ | ✗ | ? |
| No vector DB | ✓ | ✗ † | ✓ | ✗ |
| TypeScript-native | ✓ | ✗ | ✗ | ✗ |
| No server needed | ✓ | ~ ‡ | ✓ * | ✗ |
| Edge / Serverless | ✓ | ✗ | ✗ | ✓ |

† mem0 OSS uses ChromaDB (in-memory by default, optional persistence). Hosted platform uses Qdrant.<br>
‡ mem0 OSS `Memory()` runs in-process with in-memory Chroma — no separate server for dev. Production hosted mode requires the mem0 Platform server.<br>
\* basic-memory's primary integration is `uvx basic-memory mcp` which runs a separate MCP server process. Direct Python import works without a server.<br>
? Zep token budget control is not documented; marked unknown rather than ✗.<br>
✗ Zep Cloud (`@getzep/zep-cloud`) is fetch-based and runs in edge environments; the self-hosted Zep server is a separate Go service.

**memshot's actual differentiator:** it is the only library in this list that (1) runs in pure JavaScript with zero deps, (2) exposes an explicit token budget with greedy knapsack selection, and (3) ships a tier model that maps naturally to how agent context works. If you need semantic search, graph memory, or a managed service, the others are better tools.

---

[![Star History Chart](https://api.star-history.com/svg?repos=ayberkaya/memshot&type=Date)](https://star-history.com/#ayberkaya/memshot&Date)

---

## License

MIT — see [LICENSE](./LICENSE).
