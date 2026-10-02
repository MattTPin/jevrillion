import { OBSCURITY_CHOICES, SCORING_CHOICES } from '../types/index.ts'
import type {
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

// Jev's overall confidence is diagnostic. Each option has its own probability;
// only those probabilities decide eligibility and obscurity. Exact ties with
// `not` fail closed; success ties use the stable common/uncommon/obscure order.
export function scoreDecision(
  decision: Pick<JevDecision, 'probabilities'>,
  settings: ScoringSettings,
): ScoreResult {
  validateScoringSettings(settings)
  const probabilities = decision.probabilities
  for (const option of OBSCURITY_CHOICES)
    normalizeConfidence(probabilities[option], 'percent')
  const best = SCORING_CHOICES.reduce((winner, option) =>
    probabilities[option] > probabilities[winner] ? option : winner,
  )
  if (probabilities.not >= probabilities[best])
    return { choice: 'not', label: null, points: 0, reason: 'invalid' }
  // Strictly greater: at the default threshold, exactly 90% earns no points.
  if (probabilities[best] <= settings.confidenceThreshold)
    return { choice: 'not', label: null, points: 0, reason: 'low-confidence' }
  return {
    choice: best,
    label: LABELS[best],
    points: settings.points[best],
    reason: 'scored',
  }
}
