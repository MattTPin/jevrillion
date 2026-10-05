import { OBSCURITY_CHOICES } from '../src/types/index.ts'
import type {
  Attempt,
  Evaluation,
  JevDecision,
  ObscurityChoice,
  QuestionDefinition,
  ScoringSettings,
} from '../src/types/index.ts'
import { scoreDecision } from '../src/services/scoring.ts'
import { parseDecision } from '../server/services/jev/shared.ts'

export const question: QuestionDefinition = {
  uuid: '1234abcd',
  displayed_question: 'Name fruit',
  instructions: 'Classify edible culinary fruit.',
  criteria: {
    common: 'Familiar fruit.',
    uncommon: 'Less familiar fruit.',
    obscure: 'Little-known fruit.',
    not: 'Anything other than culinary fruit.',
  },
}
export const scoring: ScoringSettings = {
  confidenceThreshold: 90,
  bonusStepUpMargin: 7,
  points: { common: 10, uncommon: 20, obscure: 50 },
}
export function evaluation(
  choice: ObscurityChoice = 'common',
  probability = 99,
  settings = scoring,
): Evaluation {
  const remainder = (100 - probability) / 3
  return evaluationWithProbabilities(
    {
      common: remainder,
      uncommon: remainder,
      obscure: remainder,
      not: remainder,
      [choice]: probability,
    },
    settings,
  )
}
export function evaluationWithProbabilities(
  probabilities: JevDecision['probabilities'],
  settings = scoring,
): Evaluation {
  const choice = OBSCURITY_CHOICES.reduce((winner, option) =>
    probabilities[option] > probabilities[winner] ? option : winner,
  )
  const fractions = Object.fromEntries(
    OBSCURITY_CHOICES.map((option) => [option, probabilities[option] / 100]),
  )
  const decision = parseDecision({
    model: 'test-jev',
    answers: {
      obscurity: { type: 'choice', choice, confidence: 0.5, probabilities: fractions },
    },
  })
  return {
    version: 3,
    decision,
    scoring: settings,
    region: 'western',
    score: scoreDecision(decision, settings),
  }
}
export function attempt(): Attempt {
  return {
    id: crypto.randomUUID(),
    playerId: crypto.randomUUID(),
    playerName: 'Test player',
    questionId: question.uuid,
    displayedQuestion: question.displayed_question,
    timestamp: new Date().toISOString(),
    totalScore: 10,
    answers: [
      {
        id: crypto.randomUUID(),
        text: 'apple',
        submittedAt: new Date().toISOString(),
        status: 'done',
        evaluation: evaluation(),
      },
    ],
  }
}
