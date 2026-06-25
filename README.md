# memshot

[![npm version](https://img.shields.io/npm/v/memshot)](https://www.npmjs.com/package/memshot)
[![license](https://img.shields.io/npm/l/memshot)](./LICENSE)
[![tests](https://img.shields.io/github/actions/workflow/status/your-org/memshot/ci.yml?label=tests)](https://github.com/your-org/memshot/actions)

Tiered, token-budget-aware memory for any LLM agent — zero dependencies, no vector DB, no server.

## Problem

Most file-based memory libraries load every stored item into context on every request. mem0 acknowledged this directly in their own blog: *"Your AI Agent's Memory Is Just a File? That's the Problem."* At 500 stored memories, you are looking at 15,000+ tokens injected before the user has typed a single character. That cost compounds every call, and the signal-to-noise ratio collapses as the memory grows.

The root cause is a missing selection layer. Without one, "memory" is just a dump.

## How it works

memshot resolves context in three tiers, each with a different selection strategy. The token budget is consumed in tier order — what does not fit is dropped, not truncated.

| Tier | Selection | When to use |
|------|-----------|-------------|
| **hot** | Always included. `once: true` = once per session. | Identity, system facts, permanent instructions |
| **warm** | Included only when a `triggers` regex matches the current prompt. | Domain knowledge, project-specific context |
| **cold** | BM25 keyword score + frecency decay, greedy score/token ratio pick until budget is exhausted. | Conversation history, past decisions, event log |

```
Token budget: 4000
│
├── hot  ──── always ──────────────── 240 tokens
├── warm ──── regex match ──────────── 380 tokens  (3 of 15 triggered)
└── cold ──── BM25 + frecency ──────── 3,200 tokens (11 of 483 selected)
                                       ──────────────
                                       3,820 tokens used  (vs ~15,000 naive)
```

## Quick Start

```bash
npm install memshot
```

```ts
import { Memory, fileStore } from "memshot"

const mem = new Memory({ budget: 4000, store: fileStore("./memories") })

// add memories
await mem.add({ content: "User prefers TypeScript over Python", tier: "hot" })
await mem.add({ content: "Project: helmops yacht management", tier: "warm", triggers: [/yacht|helm/i] })
await mem.add({ content: "Last session we discussed billing...", tier: "cold" })

// resolve — selects the highest-value context within the token budget
const { text, tokensUsed } = await mem.resolve(userPrompt, { sessionId: "abc123" })
// prepend text to your system prompt
```

`fileStore` persists to disk as newline-delimited JSON. For in-process use (tests, edge functions), swap in `memoryStore` instead.

## Token budget in action

Given 500 stored items and a 4000-token budget:

| | Naive load | memshot |
|---|---|---|
| Items injected | 500 | 16 |
| Tokens used | ~15,000 | ~3,820 |
| Selection criteria | none | relevance + frecency |

The 484 items that were not selected were irrelevant to the current prompt and had not been recently accessed. They add no signal and are skipped at zero cost.

## API Reference

### `new Memory(config)`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `budget` | `number` | yes | Max tokens to inject per `resolve` call |
| `store` | `Store` | yes | Storage backend (`fileStore` or `memoryStore`) |
| `tokenizer` | `Tokenizer` | no | Defaults to character-based estimate; plug in `gpt-tokenizer` for exact counts |
| `ledger` | `SessionLedger` | no | Tracks `once: true` items per session; defaults to in-memory |

### `mem.add(item)`

Returns `Promise<MemoryItem>`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | `string` | yes | The text to store |
| `tier` | `"hot" \| "warm" \| "cold"` | yes | Selection tier |
| `triggers` | `RegExp[]` | no | Warm tier: inject only when one of these matches the prompt |
| `once` | `boolean` | no | Hot tier: inject only once per `sessionId` |
| `tags` | `string[]` | no | Arbitrary labels, available on retrieved items |

### `mem.resolve(prompt, opts)`

| Param | Type | Description |
|-------|------|-------------|
| `prompt` | `string` | Current user input; used for warm trigger matching and BM25 cold ranking |
| `opts.sessionId` | `string` | Identifies the session for `once: true` deduplication |
| `opts.now` | `number` | Unix ms timestamp; defaults to `Date.now()`. Override in tests. |

Returns `Promise<ResolveResult>`.

### `ResolveResult`

| Field | Type | Description |
|-------|------|-------------|
| `text` | `string` | Ready-to-inject memory block; prepend to your system prompt |
| `items` | `MemoryItem[]` | The selected items in tier order |
| `tokensUsed` | `number` | Total tokens consumed by this resolve |
| `tiersUsed` | `{ hot, warm, cold: number }` | Item count per tier |
| `dropped` | `{ warm, cold: number }` | Items that exceeded the budget and were excluded |

### Tiers

**hot** — Injected on every call. Use for identity, persistent instructions, and system facts. Set `once: true` to inject once per `sessionId` (useful for session-opening context that should not repeat mid-conversation).

**warm** — Injected when at least one `triggers` regex matches the current prompt. Items without `triggers` are always included when tier is warm. Use for domain knowledge that is irrelevant outside its context.

**cold** — Ranked by a composite score: 60% BM25 keyword relevance + 40% frecency (frequency × recency decay). Items are selected greedily by score/token ratio until the remaining budget is consumed.

## Adapters

### Express middleware

```ts
import { memshotMiddleware } from "memshot/adapters/express"

app.use(memshotMiddleware(mem, {
  getPrompt: (req) => req.body.messages.at(-1)?.content ?? "",
  getSessionId: (req) => req.headers["x-session-id"] ?? ""
}))

app.post("/chat", (req, res) => {
  const systemPrefix = req.memshot.text
  // prepend systemPrefix to your LLM call
})
```

### Next.js route handler

```ts
import { withMemshot } from "memshot/adapters/next"

export const POST = withMemshot(mem, async (req, { memshot }) => {
  const systemPrefix = memshot.text
  // prepend systemPrefix to your LLM call
  return Response.json({ ok: true })
})
```

### Claude Code hook (UserPromptSubmit)

```ts
import { createClaudeHook } from "memshot/adapters/claude-hook"

const hook = createClaudeHook(mem)
await hook.run()
// reads JSON from stdin, writes { additionalContext, tokensUsed } to stdout
// CLAUDE_SESSION_ID env var is used for once: true deduplication
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

## Comparison

| | memshot | mem0 | basic-memory | Zep |
|---|---|---|---|---|
| Zero dependencies | yes | no | no | no |
| Token-budget-aware | yes | no | no | no |
| No vector DB | yes | no | yes | no |
| TypeScript-native | yes | no | no | no |
| No server needed | yes | no | yes | no |
| Runs in Edge / Serverless | yes | no | no | no |

## License

MIT
