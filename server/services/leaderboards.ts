import type { Attempt } from '../../src/types/index.ts'
import {
  answerError,
  isObject,
  normalizeAnswer,
  requiredText,
} from '../../src/services/validation.ts'
import { parseSavedEvaluation } from './saved-evaluations.ts'
import { JsonFile } from './json-file.ts'
import { validationError } from '../errors.ts'
import {
  hasScoredMatch,
  validateDuplicateThreshold,
} from '../../src/services/duplicates.ts'

function identifier(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)
  )
    throw new Error('Invalid record identifier.')
  return value
}

function timestamp(value: unknown): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))
    throw new Error('Invalid timestamp.')
  return new Date(value).toISOString()
}

export function parseAttempt(value: unknown): Attempt {
  if (
    !isObject(value) ||
    !Array.isArray(value.answers) ||
    value.answers.length > 300
  )
    throw new Error('Invalid round record.')
  const seen = new Set<string>()
  const accepted = new Set<string>()
  // Older attempts retain their original exact-match policy on delayed retries.
  const duplicateSimilarityThreshold =
    value.duplicateSimilarityThreshold === undefined
      ? undefined
      : validateDuplicateThreshold(
          typeof value.duplicateSimilarityThreshold === 'number'
            ? value.duplicateSimilarityThreshold
            : NaN,
        )
  const answers: Attempt['answers'] = value.answers.map((item: unknown) => {
    if (!isObject(item)) throw new Error('Invalid answer record.')
    const text = requiredText(item.text, 'Answer', 120)
    const normalized = normalizeAnswer(text)
    if (answerError(text) || seen.has(normalized))
      throw new Error('Invalid or duplicate answer.')
    seen.add(normalized)
    const base = {
      id: identifier(item.id),
      text,
      submittedAt: timestamp(item.submittedAt),
    }
    if (item.status === 'duplicate') return { ...base, status: 'duplicate' }
    if (item.status === 'error')
      return {
        ...base,
        status: 'error',
        error: 'Answer could not be evaluated.',
      }
    if (item.status !== 'done' || !isObject(item.evaluation))
      throw new Error('Unfinished or malformed answer.')
    const evaluation = parseSavedEvaluation(item.evaluation)
    if (evaluation.score.points > 0) {
      const aliases = [
        text,
        'acceptedAnswer' in evaluation ? evaluation.acceptedAnswer : undefined,
        'suggestedAnswer' in evaluation
          ? evaluation.suggestedAnswer
          : undefined,
      ]
        .filter((value): value is string => !!value)
        .map(normalizeAnswer)
      if (
        hasScoredMatch(aliases, accepted, duplicateSimilarityThreshold ?? 100)
      )
        throw new Error('Duplicate scoring answer.')
      for (const alias of aliases) accepted.add(alias)
    }
    return {
      ...base,
      status: 'done',
      evaluation,
    }
  })
  if (
    typeof value.questionId !== 'string' ||
    !/^[a-zA-Z0-9]{8}$/.test(value.questionId)
  )
    throw new Error('Invalid question identifier.')
  if (
    value.roundSeconds !== undefined &&
    (typeof value.roundSeconds !== 'number' ||
      !Number.isSafeInteger(value.roundSeconds) ||
      value.roundSeconds < 1 ||
      value.roundSeconds > 86400)
  )
    throw new Error('Invalid round duration.')
  return {
    id: identifier(value.id),
    playerId: identifier(value.playerId),
    playerName: requiredText(value.playerName, 'Player name', 32).trim(),
    questionId: value.questionId,
    displayedQuestion: requiredText(value.displayedQuestion, 'Question', 160),
    timestamp: timestamp(value.timestamp),
    answers,
    roundSeconds: value.roundSeconds as number | undefined,
    ...(duplicateSimilarityThreshold === undefined
      ? {}
      : { duplicateSimilarityThreshold }),
    region:
      value.region === undefined
        ? undefined
        : requiredText(value.region, 'Region', 100),
    totalScore: answers.reduce(
      (total, answer) => total + (answer.evaluation?.score.points ?? 0),
      0,
    ),
  }
}

export class Leaderboards {
  private file: JsonFile<Attempt[]>
  constructor(path: string) {
    this.file = new JsonFile(path, [])
  }

  async list(playerId?: string, questionId?: string) {
    const records = await this.file.read()
    if (!Array.isArray(records)) throw new Error('Invalid leaderboard file.')
    return records
      .filter(
        (record) =>
          (!playerId || record.playerId === playerId) &&
          (!questionId || record.questionId === questionId),
      )
      .sort(
        (a, b) =>
          b.totalScore - a.totalScore || a.timestamp.localeCompare(b.timestamp),
      )
  }

  async save(value: unknown) {
    let attempt: Attempt
    try {
      attempt = parseAttempt(value)
    } catch (error) {
      throw validationError(error)
    }
    const records = await this.file.update((current) =>
      current.some((record) => record.id === attempt.id)
        ? current
        : [...current, attempt],
    )
    return records.find((record) => record.id === attempt.id)!
  }
}
