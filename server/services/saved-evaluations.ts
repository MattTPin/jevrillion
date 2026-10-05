import type {
  Evaluation,
  LegacyEvaluation,
  ScoringSettings,
} from '../../src/types/index.ts'
import {
  answerError,
  isObject,
  requiredText,
} from '../../src/services/validation.ts'
import {
  normalizeConfidence,
  scoreDecision,
  validateScoringSettings,
} from '../../src/services/scoring.ts'
import { parseDecision } from './jev/shared.ts'

// Snapshots keep historical points intact when the active settings or scoring rules change.
export function parseSavedEvaluation(
  value: unknown,
): Evaluation | LegacyEvaluation {
  if (
    !isObject(value) ||
    !isObject(value.decision) ||
    !isObject(value.decision.raw)
  )
    throw new Error('Malformed saved evaluation.')
  const raw = value.decision.raw
  if (value.version === 2 || value.version === 3) {
    if (!isObject(value.scoring) || !isObject(value.scoring.points))
      throw new Error('Missing scoring snapshot.')
    const settings = value.scoring
    const points = value.scoring.points
    if (
      typeof settings.confidenceThreshold !== 'number' ||
      (value.version === 3 && typeof settings.bonusStepUpMargin !== 'number') ||
      typeof points.common !== 'number' ||
      typeof points.uncommon !== 'number' ||
      typeof points.obscure !== 'number'
    )
      throw new Error('Invalid scoring snapshot.')
    const scoring: ScoringSettings = validateScoringSettings({
      confidenceThreshold: settings.confidenceThreshold,
      // Old snapshots predate bonuses; preserve their single-label scoring.
      bonusStepUpMargin:
        value.version === 3 ? Number(settings.bonusStepUpMargin) : 0,
      points: {
        common: points.common,
        uncommon: points.uncommon,
        obscure: points.obscure,
      },
    })
    const decision = parseDecision({
      model: raw.model,
      answers: { obscurity: raw.answer },
    })
    const region = requiredText(value.region, 'Region', 100)
    const acceptedAnswer =
      value.acceptedAnswer === undefined
        ? undefined
        : requiredText(value.acceptedAnswer, 'Accepted answer', 120)
    const suggestedAnswer =
      value.suggestedAnswer === undefined
        ? undefined
        : requiredText(value.suggestedAnswer, 'Suggested answer', 120)
    if (acceptedAnswer && answerError(acceptedAnswer))
      throw new Error('Invalid accepted answer.')
    if (suggestedAnswer && answerError(suggestedAnswer))
      throw new Error('Invalid suggested answer.')
    return {
      version: value.version,
      decision,
      scoring,
      region,
      score: scoreDecision(decision, scoring, value.version),
      ...(acceptedAnswer ? { acceptedAnswer } : {}),
      ...(suggestedAnswer ? { suggestedAnswer } : {}),
    }
  }
  if (value.version !== undefined) throw new Error('Unknown scoring version.')
  return parseLegacyEvaluation(value)
}

// Only accepts old browser retry records. Never used for new judgments.
function parseLegacyEvaluation(
  value: Record<string, unknown>,
): LegacyEvaluation {
  if (
    !isObject(value.decision) ||
    !isObject(value.decision.raw) ||
    !isObject(value.decision.raw.answer) ||
    !isObject(value.cutoffs)
  )
    throw new Error('Invalid legacy evaluation.')
  const raw = value.decision.raw
  const answer = value.decision.raw.answer
  const { common, uncommon } = value.cutoffs
  if (
    typeof common !== 'number' ||
    typeof uncommon !== 'number' ||
    !Number.isFinite(common) ||
    !Number.isFinite(uncommon) ||
    uncommon < 50 ||
    uncommon >= common ||
    common > 100 ||
    answer.type !== 'choice' ||
    (answer.choice !== 'valid' && answer.choice !== 'invalid') ||
    typeof answer.confidence !== 'number' ||
    !isObject(answer.probabilities)
  )
    throw new Error('Invalid legacy evaluation.')
  const { valid, invalid } = answer.probabilities
  if (typeof valid !== 'number' || typeof invalid !== 'number')
    throw new Error('Invalid legacy probabilities.')
  normalizeConfidence(valid, 'fraction')
  normalizeConfidence(invalid, 'fraction')
  const confidence = normalizeConfidence(answer.confidence, 'fraction')
  const isValid = answer.choice === 'valid'
  const label =
    !isValid || confidence < 50
      ? null
      : confidence >= common
        ? 'Common'
        : confidence >= uncommon
          ? 'Uncommon'
          : 'Obscure'
  return {
    decision: {
      valid: isValid,
      confidence,
      raw: {
        model: requiredText(raw.model, 'Model', 256),
        answer: {
          type: 'choice',
          choice: answer.choice,
          confidence: answer.confidence,
          probabilities: { valid, invalid },
        },
      },
    },
    cutoffs: { common, uncommon },
    score: {
      label,
      points:
        label === 'Common'
          ? 10
          : label === 'Uncommon'
            ? 20
            : label === 'Obscure'
              ? 50
              : 0,
      reason: !isValid ? 'invalid' : label ? 'scored' : 'low-confidence',
    },
  }
}
