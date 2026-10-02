import type { Evaluation } from '../../../src/types/index.ts'

// A correction can rescue a failed answer, but never replace a scoring original.
export function resolveEvaluation(
  original: Evaluation,
  corrected?: Evaluation,
  correctedAnswer?: string,
): Evaluation {
  if (original.score.points > 0)
    return correctedAnswer
      ? { ...original, suggestedAnswer: correctedAnswer }
      : original
  if (corrected?.score.points && correctedAnswer)
    return { ...corrected, acceptedAnswer: correctedAnswer }
  return original
}
