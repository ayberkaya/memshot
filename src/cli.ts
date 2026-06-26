#!/usr/bin/env node

import { Memory, fileStore, defaultTokenizer } from "./index.js"
import type { MemoryTier } from "./index.js"

const G = "\x1b[32m"
const Y = "\x1b[33m"
const C = "\x1b[36m"
const RED = "\x1b[31m"
const R = "\x1b[0m"

const VALID_TIERS = new Set<string>(["hot", "warm", "cold"])

function col(s: string, w: number): string {
  return s.slice(0, w).padEnd(w)
}

function tierLabel(tier: string): string {
  if (tier === "hot") return `${RED}hot${R}`
  if (tier === "warm") return `${Y}warm${R}`
  return `${C}cold${R}`
}

interface ParsedArgs {
  positional: string[]
  flags: Record<string, string | boolean | string[]>
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = []
  const flags: Record<string, string | boolean | string[]> = {}

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg.startsWith("--")) {
      const key = arg.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith("--")) {
        if (key === "trigger" || key === "tag") {
          const existing = flags[key]
          if (Array.isArray(existing)) {
            existing.push(next)
          } else {
            flags[key] = [next]
          }
        } else {
          flags[key] = next
        }
        i++
      } else {
        flags[key] = true
      }
    } else {
      positional.push(arg)
    }
  }

  return { positional, flags }
}

function parseTrigger(raw: string): RegExp {
  const match = raw.match(/^\/(.+)\/([gimsuy]*)$/)
  if (!match || !match[1]) throw new Error(`Invalid trigger "${raw}" — use /pattern/flags format`)
  return new RegExp(match[1], match[2] ?? "")
}

function flagString(flags: ParsedArgs["flags"], key: string): string | undefined {
  const val = flags[key]
  return typeof val === "string" ? val : undefined
}

function printUsage(): void {
  console.log(`
${C}memshot${R} — memory management CLI

${Y}Commands:${R}
  add "<content>" [--tier hot|warm|cold] [--trigger "/regex/flags"] [--once] [--tag name]
  list [--tier hot|warm|cold]
  resolve "<prompt>" [--budget 4000] [--session id] [--trace]
  stats
  delete <id>
  clear
`.trim())
}

function defaultStore() {
  return fileStore(process.env["MEMSHOT_DIR"] ?? "./.memshot")
}

export async function run(argv: string[]): Promise<number> {
  const { positional, flags } = parseArgs(argv)
  const command = positional[0]

  if (!command) {
    printUsage()
    return 1
  }

  try {
    switch (command) {
      case "add": {
        const content = positional[1]
        if (!content) {
          console.error(`${RED}error:${R} content required — add "<content>"`)
          return 1
        }

        const tierRaw = flagString(flags, "tier") ?? "warm"
        if (!VALID_TIERS.has(tierRaw)) {
          console.error(`${RED}error:${R} invalid tier "${tierRaw}" — use hot, warm, or cold`)
          return 1
        }
        const tier = tierRaw as MemoryTier

        const triggerRaws = flags["trigger"]
        const rawList = Array.isArray(triggerRaws)
          ? triggerRaws
          : typeof triggerRaws === "string"
            ? [triggerRaws]
            : []
        const triggers: RegExp[] = rawList.map(parseTrigger)

        const once = flags["once"] === true

        const tagRaws = flags["tag"]
        const tags: string[] = Array.isArray(tagRaws)
          ? tagRaws
          : typeof tagRaws === "string"
            ? [tagRaws]
            : []

        const mem = new Memory({ budget: 4000, store: defaultStore() })
        const item = await mem.add({
          content,
          tier,
          ...(triggers.length > 0 && { triggers }),
          ...(once && { once }),
          ...(tags.length > 0 && { tags }),
        })

        console.log(`${G}added${R}  ${C}${item.id.slice(0, 12)}${R}  [${tierLabel(tier)}]`)
        return 0
      }

      case "list": {
        const tierFilter = flagString(flags, "tier") as MemoryTier | undefined
        if (tierFilter && !VALID_TIERS.has(tierFilter)) {
          console.error(`${RED}error:${R} invalid tier "${tierFilter}"`)
          return 1
        }

        const mem = new Memory({ budget: 4000, store: defaultStore() })
        const tokenizer = defaultTokenizer()
        const all = await mem.store.list()
        const items = tierFilter ? all.filter((i) => i.tier === tierFilter) : all

        if (items.length === 0) {
          console.log(`${Y}no memories${R}`)
          return 0
        }

        console.log(`${C}${col("ID", 12)}  ${col("TIER", 6)}  ${col("TOKENS", 7)}  CONTENT${R}`)
        console.log("─".repeat(80))
        for (const item of items) {
          const tokens = tokenizer.count(item.content)
          const preview = item.content.slice(0, 50).replace(/\n/g, " ")
          console.log(`${col(item.id, 12)}  ${col(item.tier, 6)}  ${col(String(tokens), 7)}  ${preview}`)
        }
        return 0
      }

      case "resolve": {
        const prompt = positional[1]
        if (!prompt) {
          console.error(`${RED}error:${R} prompt required — resolve "<prompt>"`)
          return 1
        }

        const budgetRaw = flagString(flags, "budget")
        const budget = budgetRaw ? parseInt(budgetRaw, 10) : 4000
        if (isNaN(budget) || budget <= 0) {
          console.error(`${RED}error:${R} invalid budget "${budgetRaw}"`)
          return 1
        }

        const sessionId = flagString(flags, "session")
        const trace = flags["trace"] === true

        const mem = new Memory({ budget, store: defaultStore() })
        const resolveOpts: { sessionId?: string; trace: boolean } = { trace }
        if (sessionId !== undefined) resolveOpts.sessionId = sessionId
        const result = await mem.resolve(prompt, resolveOpts)

        console.log(`${C}tokens used:${R} ${result.tokensUsed} / ${budget}`)
        console.log(`${C}tiers:${R}      hot=${result.tiersUsed.hot} warm=${result.tiersUsed.warm} cold=${result.tiersUsed.cold}`)
        console.log(`${C}dropped:${R}    warm=${result.dropped.warm} cold=${result.dropped.cold}`)

        if (result.items.length === 0) {
          console.log(`\n${Y}no memories selected${R}`)
        } else {
          console.log(`\n${G}selected:${R}`)
          for (const item of result.items) {
            const preview = item.content.slice(0, 60).replace(/\n/g, " ")
            console.log(`  ${C}${item.id.slice(0, 12)}${R}  [${tierLabel(item.tier)}]  ${preview}`)
          }
        }

        if (trace && result.trace) {
          const { entries } = result.trace
          console.log(
            `\n${C}${col("ID", 12)}  ${col("TIER", 6)}  INC  ${col("TOKENS", 7)}  ${col("COMPOSITE", 10)}  REASON${R}`
          )
          console.log("─".repeat(90))
          for (const entry of entries) {
            const composite =
              entry.scores?.composite != null ? entry.scores.composite.toFixed(3) : "—"
            const inc = entry.included ? `${G}✓${R}` : `${RED}✗${R}`
            console.log(
              `${col(entry.id, 12)}  ${col(entry.tier, 6)}  ${inc}   ${col(String(entry.tokens), 7)}  ${col(composite, 10)}  ${entry.reason}`
            )
          }
        }
        return 0
      }

      case "stats": {
        const mem = new Memory({ budget: 4000, store: defaultStore() })
        const s = await mem.stats()

        console.log(`${C}total:${R} ${s.total} memories`)
        console.log()
        console.log(`  ${RED}hot${R}   ${s.byTier.hot} items    ${s.tokens.byTier.hot} tokens`)
        console.log(`  ${Y}warm${R}  ${s.byTier.warm} items    ${s.tokens.byTier.warm} tokens`)
        console.log(`  ${C}cold${R}  ${s.byTier.cold} items    ${s.tokens.byTier.cold} tokens`)
        console.log()
        console.log(`${C}tokens:${R}  total=${s.tokens.total}  avg=${s.tokens.average.toFixed(1)}`)

        if (s.oldest) {
          const ts = new Date(s.oldest.createdAt).toISOString()
          console.log(`${C}oldest:${R}  ${s.oldest.id.slice(0, 12)}  (${ts})`)
        }
        if (s.newest) {
          const ts = new Date(s.newest.createdAt).toISOString()
          console.log(`${C}newest:${R}  ${s.newest.id.slice(0, 12)}  (${ts})`)
        }
        if (s.cold) {
          console.log(
            `${C}cold:${R}    total accesses=${s.cold.totalAccesses}  avg=${s.cold.averageAccessCount.toFixed(2)}`
          )
        }
        return 0
      }

      case "delete": {
        const id = positional[1]
        if (!id) {
          console.error(`${RED}error:${R} id required — delete <id>`)
          return 1
        }
        const mem = new Memory({ budget: 4000, store: defaultStore() })
        await mem.delete(id)
        console.log(`${G}deleted${R} ${id}`)
        return 0
      }

      case "clear": {
        const mem = new Memory({ budget: 4000, store: defaultStore() })
        await mem.clear()
        console.log(`${G}cleared${R} all memories`)
        return 0
      }

      default: {
        console.error(`${RED}unknown command:${R} ${command}`)
        console.log()
        printUsage()
        return 1
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`${RED}error:${R} ${msg}`)
    return 1
  }
}

run(process.argv.slice(2)).then(process.exit).catch(() => process.exit(1))
