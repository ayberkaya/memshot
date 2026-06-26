import { tokenize } from "./tokenize.js"

export function jaccard(a: string, b: string): number {
  const setA = new Set(tokenize(a))
  const setB = new Set(tokenize(b))
  if (setA.size === 0 && setB.size === 0) return 1
  if (setA.size === 0 || setB.size === 0) return 0
  let intersection = 0
  for (const term of setA) {
    if (setB.has(term)) intersection++
  }
  return intersection / (setA.size + setB.size - intersection)
}
