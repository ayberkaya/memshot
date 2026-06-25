import { Memory, memoryStore } from "../src/index.ts"

const testPrompt = "We discussed the billing integration last week, what did we decide about the pricing model?"

const hotItems = [
  "User's name is Ayberk.",
  "Preferred language: TypeScript.",
  "Use concise answers unless the task needs detail.",
  "Prefer zero-dependency libraries for agent infrastructure.",
  "Memory context must stay inside the configured token budget."
]

const warmItems: Array<{ content: string; triggers: RegExp[] }> = [
  { content: "Billing decisions should include metering, invoice state, retry policy, and customer-facing audit trails before implementation begins.", triggers: [/billing/i] },
  { content: "Pricing notes: keep the starter tier simple, make usage limits visible, and reserve enterprise controls for paid expansion.", triggers: [/pricing/i] },
  { content: "Integration planning requires auth ownership, webhook idempotency, payload versioning, and a rollback path for failed syncs.", triggers: [/integration/i] },
  { content: "Model selection should balance latency, cost, context length, and reliability before optimizing for benchmark scores.", triggers: [/model/i] },
  { content: "Auth changes must define session boundaries, token rotation, provider fallbacks, and account recovery behavior.", triggers: [/auth|login|session/i] },
  { content: "Deployment reviews should check environment parity, migration order, feature flags, and health checks before release.", triggers: [/deploy|release|production/i] },
  { content: "Performance work starts with measurement: p95 latency, cache hit rate, bundle size, database timings, and cold starts.", triggers: [/performance|latency|speed/i] },
  { content: "Database schema changes need reversible migrations, indexes for query shape, and a backfill plan when rows already exist.", triggers: [/database|schema|migration/i] },
  { content: "Webhook handlers must verify signatures, dedupe delivery IDs, store raw events, and return quickly after enqueueing work.", triggers: [/webhook|stripe/i] },
  { content: "Onboarding should show one immediate win, defer configuration, and capture user intent without blocking the first action.", triggers: [/onboarding|activation/i] },
  { content: "Support flows need issue categories, severity labels, reproduction steps, and a clear owner for customer follow-up.", triggers: [/support|ticket/i] },
  { content: "Analytics events should be named in past tense, include stable IDs, and avoid collecting unnecessary personal data.", triggers: [/analytics|tracking/i] },
  { content: "Security reviews require input validation, authorization checks, rate limits, secret handling, and dependency exposure review.", triggers: [/security|vulnerability/i] },
  { content: "Cache strategy should document invalidation triggers, stale windows, key structure, and what happens during cache misses.", triggers: [/cache|caching/i] },
  { content: "Email flows need idempotent sends, unsubscribe handling where relevant, brand-safe copy, and delivery monitoring.", triggers: [/email|notification/i] },
  { content: "API design should keep resources predictable, errors typed, pagination explicit, and idempotency available for writes.", triggers: [/api|endpoint/i] },
  { content: "Observability work should connect logs, metrics, traces, and user-visible symptoms instead of adding isolated dashboards.", triggers: [/observability|logs|metrics/i] },
  { content: "Data import flows need validation previews, row-level errors, duplicate detection, and resumable processing for large files.", triggers: [/import|csv|upload/i] },
  { content: "Search quality improves when ranking combines exact match, recency, filters, and domain-specific synonyms.", triggers: [/search|ranking/i] },
  { content: "Mobile views should prioritize thumb reach, readable density, resilient offline states, and fast recovery from network loss.", triggers: [/mobile|responsive/i] },
  { content: "Teams features require roles, permissions, invitation lifecycle, audit logs, and clear transfer of ownership.", triggers: [/team|workspace|roles/i] },
  { content: "Subscription plans should align with customer value metrics, not internal technical limits that buyers do not understand.", triggers: [/subscription|plan/i] },
  { content: "Trial conversion improves when upgrade prompts appear after value is demonstrated, not before the first successful outcome.", triggers: [/trial|conversion/i] },
  { content: "File storage should define retention, access control, virus scanning needs, size limits, and deletion semantics.", triggers: [/file|storage|attachment/i] },
  { content: "Background jobs need retry limits, dead-letter handling, idempotency keys, and operator visibility into stuck work.", triggers: [/job|queue|worker/i] },
  { content: "Admin panels should expose safe operations, confirmation steps for destructive actions, and searchable audit history.", triggers: [/admin|operator/i] },
  { content: "Internationalization requires locale-aware dates, currency formatting, pluralization, and copy that can expand without breaking layout.", triggers: [/i18n|locale|currency/i] },
  { content: "Compliance work starts by mapping data collected, storage duration, processing purpose, subprocessors, and deletion requests.", triggers: [/compliance|privacy|gdpr/i] },
  { content: "Feature flags should have owners, expiry dates, default states, and documented cleanup once a rollout is complete.", triggers: [/feature flag|rollout/i] },
  { content: "Rate limiting should be scoped by actor, endpoint sensitivity, burst behavior, and customer impact during false positives.", triggers: [/rate limit|quota/i] },
  { content: "LLM prompts should separate instructions, retrieved memory, user input, and tool results to reduce accidental prompt leakage.", triggers: [/prompt|llm|agent/i] },
  { content: "Evaluation datasets should contain real failure modes, expected outputs, regression cases, and enough variety to prevent overfitting.", triggers: [/evaluation|eval|benchmark/i] },
  { content: "Design systems need tokens, component constraints, accessibility states, and examples that show both dense and empty screens.", triggers: [/design system|component/i] },
  { content: "Financial exports should reconcile with source records, include timezone assumptions, and preserve immutable historical totals.", triggers: [/finance|export|reconcile/i] },
  { content: "A migration cutover needs a freeze window, verification checklist, fallback owner, and communication plan for affected users.", triggers: [/cutover|migration/i] },
  { content: "Third-party vendors should be evaluated for uptime, data portability, pricing risk, support quality, and lock-in exposure.", triggers: [/vendor|third-party/i] },
  { content: "Documentation should answer installation, first success, common failures, API shape, and operational limits without marketing filler.", triggers: [/docs|documentation/i] },
  { content: "Roadmap decisions should connect user pain, willingness to pay, implementation cost, and strategic positioning.", triggers: [/roadmap|prioritize/i] },
  { content: "Incident response requires severity levels, escalation channels, customer updates, timeline notes, and a blameless follow-up.", triggers: [/incident|outage/i] },
  { content: "Data retention policy should distinguish active records, archived records, backups, and legally required preservation windows.", triggers: [/retention|archive/i] },
  { content: "Payments UX should make status, next charge, failed payment recovery, and receipt access obvious to the customer.", triggers: [/payment|checkout/i] },
  { content: "Model cost controls should combine request budgeting, caching, cheaper fallbacks, and clear degradation when context is too large.", triggers: [/model|cost|tokens/i] },
  { content: "Integration billing plan from last week: start with Stripe hosted checkout, map external account IDs, and keep pricing rules local.", triggers: [/billing|integration|pricing/i] },
  { content: "The pricing model decision was usage-aware tiers: free developer testing, paid pro limits, and custom enterprise contracts later.", triggers: [/pricing|model/i] },
  { content: "For billing integration, avoid custom invoicing in v1; ship subscriptions first, then add usage reconciliation after feedback.", triggers: [/billing|integration/i] }
]

const topics = [
  "product decision", "meeting note", "code review", "bug report", "retrospective", "customer interview", "release note", "support summary", "architecture review", "growth experiment"
]

const subjects = [
  "onboarding checklist", "dashboard filters", "workspace permissions", "notification center", "import pipeline", "mobile layout", "search ranking", "audit trail", "export flow", "settings page"
]

const outcomes = [
  "keep the first version narrow and measure whether users complete the primary action without help",
  "delay the advanced configuration until repeated customer requests prove that the extra surface area is worth maintaining",
  "ship behind a small rollout flag and compare support volume before making the behavior the default",
  "rewrite the copy around the actual user job instead of exposing internal implementation terms",
  "move the slow operation into a background path and keep the interface responsive during retries",
  "add stronger validation at the boundary so downstream services receive predictable data",
  "document the tradeoff clearly because the faster implementation creates a visible product constraint",
  "keep ownership with one maintainer until the workflow stabilizes and handoff notes are complete",
  "remove the optional step from the first run because it created hesitation before users saw value",
  "capture structured evidence before changing the roadmap because the anecdotes conflict with usage data"
]

function coldMemory(index: number): string {
  const topic = topics[index % topics.length]
  const subject = subjects[(index * 3) % subjects.length]
  const outcome = outcomes[(index * 7) % outcomes.length]
  const week = 1 + (index % 12)
  const owner = ["Ayberk", "Mina", "Deniz", "Ece", "Koray"][(index * 5) % 5]
  return `Week ${week} ${topic} for the ${subject}. ${owner} summarized the user context, the constraint we found during implementation, and the risk of expanding scope too early. The decision was to ${outcome}. Follow-up notes recorded the expected success signal, the owner for verification, and the condition that would make us revisit the decision.`
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US")
}

function reduction(before: number, after: number): string {
  return `-${(((before - after) / before) * 100).toFixed(1)}%`
}

function row(label: string, naive: string, memshot: string, savings: string): string {
  return `${label.padEnd(14)}${naive.padStart(8)}${memshot.padStart(10)}${savings.padStart(10)}`
}

async function main(): Promise<void> {
  try {
    const mem = new Memory({ budget: 4000, store: memoryStore() })
    const contents: string[] = []

    for (const content of hotItems) {
      await mem.add({ content, tier: "hot" })
      contents.push(content)
    }

    for (const item of warmItems) {
      await mem.add({ content: item.content, tier: "warm", triggers: item.triggers })
      contents.push(item.content)
    }

    for (let index = 0; index < 450; index += 1) {
      const content = coldMemory(index)
      await mem.add({ content, tier: "cold" })
      contents.push(content)
    }

    const result = await mem.resolve(testPrompt, { sessionId: "bench" })
    const naiveTokens = contents.reduce((total, content) => total + Math.ceil(content.length / 4), 0)
    const lines = [
      "memshot benchmark — 500 memories, 4000-token budget",
      "─────────────────────────────────────────────────",
      row("", "naive", "memshot", "savings"),
      row("items", formatNumber(contents.length), formatNumber(result.items.length), reduction(contents.length, result.items.length)),
      row("tokens used", formatNumber(naiveTokens), formatNumber(result.tokensUsed), reduction(naiveTokens, result.tokensUsed)),
      "─────────────────────────────────────────────────",
      "reproduce: npm run benchmark"
    ]

    process.stdout.write(`${lines.join("\n")}\n`)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Benchmark failed"
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  }
}

void main()