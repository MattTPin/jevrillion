import dictionary from 'dictionary-en'
import nspell from 'nspell'
import { cleanAnswer } from '../../src/services/validation.ts'

export interface AnswerCandidates {
  originalAnswer: string
  correctedAnswer?: string
}

const checker = nspell({
  aff: Buffer.from(dictionary.aff),
  dic: Buffer.from(dictionary.dic),
})
const simpleWord = /^\p{L}+$/u

// Adjacent transpositions count as one edit, like other common typing slips.
export function editDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, () =>
    Array<number>(b.length + 1).fill(0),
  )
  for (let i = 0; i <= a.length; i++) rows[i][0] = i
  for (let j = 0; j <= b.length; j++) rows[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1)
    }
  }
  return rows[a.length][b.length]
}

export function answerCandidates(input: string): AnswerCandidates {
  const originalAnswer = cleanAnswer(input)
  const result: AnswerCandidates = { originalAnswer }
  const words = originalAnswer.split(' ')
  // Preserve names and phrases with several unknown terms for Jev's judgment.
  if (words.some((word) => !simpleWord.test(word))) return result
  const unknown = words.flatMap((word, index) =>
    checker.correct(word) ? [] : [index],
  )
  if (unknown.length !== 1) return result
  const index = unknown[0]
  const word = words[index].toLowerCase()
  if (word.length < 4) return result
  const suggestions = checker
    .suggest(word)
    .map((candidate) => candidate.toLowerCase())
    .filter((candidate) => simpleWord.test(candidate) && candidate !== word)
    .map((candidate) => ({
      candidate,
      distance: editDistance(word, candidate),
    }))
    .sort(
      (a, b) =>
        a.distance - b.distance || a.candidate.localeCompare(b.candidate),
    )
  const best = suggestions[0]
  if (!best) return result
  const allowed = word.length <= 5 ? 1 : word.length <= 10 ? 2 : 3
  if (
    best.distance > allowed ||
    best.distance / Math.max(word.length, best.candidate.length) > 0.25
  )
    return result
  words[index] = best.candidate
  const correctedAnswer = words.join(' ')
  if (correctedAnswer.length > 120) return result
  if (correctedAnswer.toLowerCase() !== originalAnswer.toLowerCase())
    result.correctedAnswer = correctedAnswer
  return result
}
