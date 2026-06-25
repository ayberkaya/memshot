import { createRequire } from "node:module"

export interface Tokenizer {
  count(text: string): number
}

type EncodeModule = {
  encode(text: string): unknown
}

function hasEncode(value: unknown): value is EncodeModule {
  return typeof value === "object" && value !== null && "encode" in value && typeof value.encode === "function"
}

function heuristicCount(text: string): number {
  return Math.ceil(text.length / 4)
}

function optionalTokenizer(): EncodeModule | undefined {
  try {
    const require = createRequire(import.meta.url)
    const tokenizerModule: unknown = require("gpt-tokenizer")
    return hasEncode(tokenizerModule) ? tokenizerModule : undefined
  } catch {
    return undefined
  }
}

export function defaultTokenizer(): Tokenizer {
  let tokenizerModule = optionalTokenizer()
  const tokenizerPackage = "gpt-tokenizer"

  void import(tokenizerPackage)
    .then((module: unknown) => {
      if (hasEncode(module)) tokenizerModule = module
    })
    .catch(() => undefined)

  return {
    count(text: string) {
      try {
        const encoded = tokenizerModule?.encode(text)
        return Array.isArray(encoded) ? encoded.length : heuristicCount(text)
      } catch {
        return heuristicCount(text)
      }
    }
  }
}
