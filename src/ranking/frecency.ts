export interface FrecencyInput {
  accessCount: number
  lastAccessedAt: number
  createdAt: number
  now?: number
}

export function frecencyScore(input: FrecencyInput): number {
  const now = input.now ?? Date.now()
  const referenceTime = input.accessCount === 0 && input.lastAccessedAt === 0 ? input.createdAt : input.lastAccessedAt
  const hoursElapsed = Math.max(0, (now - referenceTime) / 3_600_000)
  const decay = Math.exp(-0.1 * hoursElapsed)
  return Math.log1p(input.accessCount) * decay
}
