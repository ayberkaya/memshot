export function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[\s\W]+/).filter(Boolean)
}
