import { normalizeAnswer } from './validation.ts'

export const DEFAULT_DUPLICATE_SIMILARITY_THRESHOLD = 95

export function validateDuplicateThreshold(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 100)
    throw new Error('DUPLICATE_SIMILARITY_THRESHOLD must be between 0 and 100.')
  return value
}

// Jaro–Winkler similarity, expressed as a percentage. Prefix boost uses the
// standard 0.1 scaling, at most four letters, and a Jaro score above 0.7.
// Compare whole answers: no substring, token sorting, or semantic matching.
export function answerSimilarity(first: string, second: string): number {
  const left = normalizeAnswer(first)
  const right = normalizeAnswer(second)
  if (left === right) return 100
  // Canonical ordering makes repeated-letter matching symmetric in both orders.
  const [a, b] =
    left < right ? [[...left], [...right]] : [[...right], [...left]]
  if (!a.length || !b.length) return 0
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1)
  const matchedA = Array<boolean>(a.length).fill(false)
  const matchedB = Array<boolean>(b.length).fill(false)
  let matches = 0
  for (let i = 0; i < a.length; i++) {
    for (
      let j = Math.max(0, i - window);
      j < Math.min(b.length, i + window + 1);
      j++
    ) {
      if (!matchedB[j] && a[i] === b[j]) {
        matchedA[i] = true
        matchedB[j] = true
        matches++
        break
      }
    }
  }
  if (!matches) return 0
  const sequenceA = a.filter((_, i) => matchedA[i])
  const sequenceB = b.filter((_, i) => matchedB[i])
  const transpositions =
    sequenceA.filter((char, i) => char !== sequenceB[i]).length / 2
  const jaro =
    (matches / a.length +
      matches / b.length +
      (matches - transpositions) / matches) /
    3
  let prefix = 0
  while (prefix < Math.min(4, a.length, b.length) && a[prefix] === b[prefix])
    prefix++
  return 100 * (jaro > 0.7 ? jaro + prefix * 0.1 * (1 - jaro) : jaro)
}

export function hasScoredMatch(
  candidates: readonly string[],
  scoredAnswers: Iterable<string>,
  threshold: number,
): boolean {
  for (const scored of scoredAnswers)
    if (
      candidates.some(
        (candidate) => answerSimilarity(candidate, scored) >= threshold,
      )
    )
      return true
  return false
}
