const K1 = 1.5
const B = 0.75

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[\s\W]+/).filter(Boolean)
}

export function bm25Score(query: string, document: string): number {
  const queryTerms = tokenize(query)
  if (queryTerms.length === 0) return 0

  const docTerms = tokenize(document)
  if (docTerms.length === 0) return 0

  const frequencies = new Map<string, number>()
  for (const term of docTerms) frequencies.set(term, (frequencies.get(term) ?? 0) + 1)

  const docLength = docTerms.length
  const averageDocLength = docLength
  let score = 0

  for (const term of queryTerms) {
    const termFrequency = frequencies.get(term) ?? 0
    if (termFrequency === 0) continue
    const documentFrequency = 1
    const idf = Math.log((1 - documentFrequency + 0.5) / (documentFrequency + 0.5) + 1)
    const denominator = termFrequency + K1 * (1 - B + B * (docLength / averageDocLength))
    score += idf * ((termFrequency * (K1 + 1)) / denominator)
  }

  return score
}
