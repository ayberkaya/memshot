# Changelog

## [0.2.0] — 2026-06-26

### Added
- **Real corpus-aware BM25** — replaced single-document TF saturation with a full BM25 implementation using corpus-level IDF and length normalization. Cold-tier ranking now correctly discriminates by keyword rarity across the entire memory store.
- `mem.stats()` — returns tier counts, token totals, average tokens, oldest/newest item, and cold-tier access metrics.
- `mem.update(id, patch)` — exposes `store.update` on the `Memory` class for patching content, tier, triggers, tags, and `once`.
- `resolve(prompt, { trace: true })` — opt-in trace mode. Returns `ResolveTrace` with per-item breakdown: tier, included/excluded, reason, and BM25/frecency/composite scores for cold items.
- Dedup on add: `mem.add(item, { dedupe: true })` skips near-duplicate content (Jaccard ≥ 0.85 by default). Configurable threshold, strategy (`skip` | `update`), and scope (`same-tier` | `all`).
- `npx memshot` CLI — `add`, `list`, `resolve`, `stats`, `delete`, `clear` commands. `--trace` flag shows per-item score breakdown in the terminal.
- `playground/index.html` — zero-install browser playground. Open the file, add memories, resolve prompts, inspect trace output.
- `src/ranking/tokenize.ts` — shared tokenizer extracted from BM25 module.
- `src/ranking/similarity.ts` — Jaccard similarity over term sets for dedup.
- `src/explain.ts` — `buildTrace()` for assembling resolve traces from allocation data.
- Exported types: `MemoryStats`, `DedupeOptions`, `UpdatePatch`, `ResolveTrace`, `MemoryTraceEntry`, `ScoreBreakdown`, `AllocationResult`, `MemoryTier`.

### Fixed
- BM25 was not corpus-aware: `documentFrequency` was hardcoded to `1` and `averageDocLength` was always the current document's length, making IDF constant and length normalization dead.
- `LICENSE` file was missing despite `package.json` and README declaring MIT.
- Benchmark used `length/4` heuristic for both naive and memshot counts. Now uses `defaultTokenizer()` for both — real token comparison when `gpt-tokenizer` is installed.

### Changed
- `package.json` version: `0.1.0` → `0.2.0`
- `gpt-tokenizer` added to `devDependencies` (stays optional peer dep for consumers — zero-dep promise intact).
- `AllocationResult` now includes `excludedWarm` and `excludedCold` arrays (additive — `dropped` counts unchanged).
- `ScoredItem` now has optional `breakdown?: ScoreBreakdown` field (additive).
- `ResolveResult` now has optional `trace?: ResolveTrace` field (additive — only present when `trace: true` is passed).
- `mem.add()` accepts optional second argument `opts?: { dedupe?: boolean | DedupeOptions }` (backward compatible).
- `mem.resolve()` options now accept `trace?: boolean` (additive).

### Breaking Changes
None. All changes are additive. v0.1.0 code runs unchanged.

## [0.1.0] — 2026-06-26

Initial release. Tiered token-budget-aware memory for LLM agents. Zero dependencies. Three tiers (hot/warm/cold), greedy knapsack budget allocation, BM25 + frecency cold ranking, Express/Next.js/Claude Code hook adapters.
