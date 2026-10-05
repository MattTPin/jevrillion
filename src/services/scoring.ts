import { OBSCURITY_CHOICES, SCORING_CHOICES } from '../types/index.ts'
import type {
  Evaluation,
  JevDecision,
  Rarity,
  ScoreResult,
  ScoringSettings,
} from '../types/index.ts'

export const LABELS = {
  common: 'Common',
  uncommon: 'Uncommon',
  obscure: 'Obscure',
} satisfies Record<string, Rarity>

export function validateScoringSettings(
  settings: ScoringSettings,
): ScoringSettings {
  if (
    !Number.isFinite(settings.confidenceThreshold) ||
    settings.confidenceThreshold < 0 ||
    settings.confidenceThreshold > 100
  )
    throw new Error('CONFIDENCE_THRESHOLD must be between 0 and 100.')
  if (
    !Number.isFinite(settings.bonusStepUpMargin) ||
    settings.bonusStepUpMargin < 0 ||
    settings.bonusStepUpMargin > 100
  )
    throw new Error('BONUS_STEP_UP_MARGIN must be between 0 and 100.')
  for (const option of SCORING_CHOICES) {
    const points = settings.points[option]
    if (!Number.isSafeInteger(points) || points < 0 || points > 1_000_000)
      throw new Error(
        'Scoring points must be whole numbers between 0 and 1000000.',
      )
  }
  return settings
}

export function normalizeConfidence(
  value: number,
  scale: 'fraction' | 'percent',
): number {
  const max = scale === 'fraction' ? 1 : 100
  if (!Number.isFinite(value) || value < 0 || value > max)
    throw new Error('Invalid confidence.')
  return scale === 'fraction' ? value * 100 : value
}

// Overall confidence stays diagnostic; only the four choice probabilities score.
// The version argument is only for restoring historical records. New rounds use V3.
export function scoreDecision(
  decision: Pick<JevDecision, 'probabilities'>,
  settings: ScoringSettings,
  version: Evaluation['version'] = 3,
): ScoreResult {
  validateScoringSettings(settings)
  const probabilities = decision.probabilities
  for (const option of OBSCURITY_CHOICES)
    normalizeConfidence(probabilities[option], 'percent')
  // Success ties start with the lower tier, giving promotion a stable baseline.
  const best = SCORING_CHOICES.reduce((winner, option) =>
    probabilities[option] > probabilities[winner] ? option : winner,
  )
  // A winning or tied "not" cannot be rescued by a bonus. This keeps category
  // rejection separate from generosity about an otherwise valid answer's rarity.
  if (probabilities.not >= probabilities[best])
    return { choice: 'not', label: null, points: 0, reason: 'invalid' }

  // Rarity uncertainty should not invalidate a strong category match. Pool the
  // three success probabilities before applying the strict acceptance threshold.
  // V2 retries retain their original single-label gate and never receive bonuses.
  const categoryProbability = SCORING_CHOICES.reduce(
    (total, option) => total + probabilities[option],
    0,
  )
  const requiredProbability =
    version === 2 ? probabilities[best] : categoryProbability
  const belowThreshold =
    version === 2
      ? requiredProbability <= settings.confidenceThreshold
      : requiredProbability - settings.confidenceThreshold <= 1e-9
  if (belowThreshold)
    return { choice: 'not', label: null, points: 0, reason: 'low-confidence' }

  const next = SCORING_CHOICES[SCORING_CHOICES.indexOf(best) + 1]
  const gap = next ? probabilities[best] - probabilities[next] : Infinity
  // Reward a close call with exactly ONE step (common -> uncommon, or uncommon
  // -> obscure). Compare against the original winner, so bonuses cannot cascade.
  // Zero disables the exception; a zero-probability tier is never promoted.
  // A tiny tolerance handles floating-point gaps such as 7.000000000000007.
  const promoted =
    version === 3 &&
    settings.bonusStepUpMargin > 0 &&
    next !== undefined &&
    probabilities[next] > 0 &&
    gap <= settings.bonusStepUpMargin + 1e-9
  const choice = promoted ? next : best
  return {
    choice,
    label: LABELS[choice],
    points: settings.points[choice],
    reason: 'scored',
    ...(promoted ? { stepUp: { from: best, probabilityGap: gap } } : {}),
  }
}
