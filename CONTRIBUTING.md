# Contributing

## Setup

```bash
git clone https://github.com/ayberkaya/memshot
cd memshot
npm install   # or bun install
```

## Development

```bash
npm run dev        # tsup watch mode
npm test           # vitest
npm run typecheck  # tsc --noEmit
npm run benchmark  # 500-memory benchmark
```

## Project structure

```
src/
  index.ts          — public API exports
  memory.ts         — Memory class (add, resolve, update, stats, clear, delete)
  budget.ts         — token allocation (greedy knapsack)
  tiers.ts          — tier resolution (hot / warm / cold)
  explain.ts        — trace assembly (buildTrace)
  session.ts        — once-per-session ledger
  tokenizer.ts      — gpt-tokenizer wrapper with heuristic fallback
  cli.ts            — npx memshot CLI
  ranking/
    bm25.ts         — corpus-aware BM25 (buildCorpus, scoreCorpus)
    frecency.ts     — frecency decay score
    tokenize.ts     — shared text tokenizer
    similarity.ts   — Jaccard similarity for dedup
  store/
    index.ts        — Store interface + MemoryItem type
    memory.ts       — in-memory store (Map)
    file.ts         — file-system store (JSON files)
  adapters/
    express.ts      — Express middleware
    next.ts         — Next.js route handler wrapper
    claude-hook.ts  — Claude Code UserPromptSubmit hook
tests/
  bm25.test.ts        — single-doc BM25 (legacy wrapper tests)
  bm25.corpus.test.ts — corpus-aware BM25 (regression guard for IDF + length norm)
examples/
  benchmark.ts      — 500-memory benchmark with real token counts
playground/
  index.html        — zero-install browser playground
```

## Guidelines

- Zero runtime dependencies. Nothing goes in `dependencies`. Keep it that way.
- TypeScript strict. No `any`.
- Tests must pass: `npm test`. Don't touch existing tests unless the task explicitly requires it.
- Max 800 lines per file; functions max 50 lines.
- No `console.log` in library code. `console.warn` is OK for budget overflow warnings.

## Adding a storage backend

Implement the `Store` interface from `src/store/index.ts`. Export a factory function from `src/store/yourbackend.ts` and re-export it from `src/index.ts`.

## Pull requests

- One logical change per PR.
- Tests for new behavior.
- Update CHANGELOG.md under an `[Unreleased]` section.

## Releasing

```bash
npm version patch|minor|major
git push --follow-tags
npm publish --access public
```
