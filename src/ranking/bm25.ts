import { tokenize } from "./tokenize.js"

const K1 = 1.5
const B = 0.75

export interface Bm25Corpus {
  docCount: number
  avgDocLength: number
  df: Map<string, number>
  docs: Array<{ length: number; tf: Map<string, number> }>
}

export function buildCorpus(documents: string[]): Bm25Corpus {
  if (documents.length === 0) {
    return { docCount: 0, avgDocLength: 1, df: new Map(), docs: [] }
  }

  const df = new Map<string, number>()
  const docs: Array<{ length: number; tf: Map<string, number> }> = []
  let totalLength = 0

  for (const doc of documents) {
    const terms = tokenize(doc)
    const tf = new Map<string, number>()
    for (const term of terms) tf.set(term, (tf.get(term) ?? 0) + 1)
    for (const term of tf.keys()) df.set(term, (df.get(term) ?? 0) + 1)
    docs.push({ length: terms.length, tf })
    totalLength += terms.length
  }

  return {
    docCount: documents.length,
    avgDocLength: totalLength / documents.length || 1,
    df,
    docs
  }
}

export function scoreCorpus(query: string, corpus: Bm25Corpus): number[] {
  if (corpus.docCount === 0) return []
  const queryTerms = tokenize(query)
  if (queryTerms.length === 0) return corpus.docs.map(() => 0)

  const N = corpus.docCount
  const avgdl = corpus.avgDocLength

  return corpus.docs.map((doc) => {
    let score = 0
    for (const term of queryTerms) {
      const tf = doc.tf.get(term) ?? 0
      if (tf === 0) continue
      const dfVal = corpus.df.get(term) ?? 0
      const idf = Math.log(1 + (N - dfVal + 0.5) / (dfVal + 0.5))
      score += idf * (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * (doc.length / avgdl)))
    }
    return score
  })
}

export function bm25Score(query: string, document: string): number {
  const corpus = buildCorpus([document])
  return scoreCorpus(query, corpus)[0] ?? 0
}
