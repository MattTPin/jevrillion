import type {
  Credentials,
  Evaluation,
  QuestionDefinition,
} from '../../../src/types/index.ts'
import { scoreDecision } from '../../../src/services/scoring.ts'
import type { ServerConfig } from '../../config.ts'
import { AppError } from '../../errors.ts'
import { answerCandidates } from '../spelling.ts'
import type { AnswerCandidates } from '../spelling.ts'
import { evaluateOpenRouter } from './openrouter.ts'
import { resolveEvaluation } from './resolve.ts'

export function createJudge(config: ServerConfig) {
  return async (
    credentials: Credentials,
    question: QuestionDefinition,
    answer: string,
    candidates?: AnswerCandidates,
  ): Promise<Evaluation> => {
    const apiKey = credentials.apiKey
    if (!apiKey)
      throw new AppError(401, 'missing_key', 'Connect OpenRouter first.')
    const { originalAnswer, correctedAnswer } =
      candidates ?? answerCandidates(answer)
    const decisions = await evaluateOpenRouter(
      apiKey,
      credentials.model ?? config.model,
      question,
      originalAnswer,
      config.publicConfig.region.prompt,
      correctedAnswer,
    )
    const scoring = config.publicConfig.scoring
    const evaluate = (decision: typeof decisions.original): Evaluation => ({
      version: 3,
      decision,
      scoring,
      region: config.publicConfig.region.id,
      score: scoreDecision(decision, scoring),
    })
    return resolveEvaluation(
      evaluate(decisions.original),
      decisions.corrected && evaluate(decisions.corrected),
      correctedAnswer,
    )
  }
}

export const checkQuestion: QuestionDefinition = {
  uuid: 'keycheck',
  displayed_question: 'Connection check',
  instructions:
    'Classify the candidate as a culinary fruit by everyday awareness. Reject non-fruit items.',
  criteria: {
    common: 'A culinary fruit almost everyone knows and commonly encounters.',
    uncommon:
      'A culinary fruit known by some people but usually found in specialty shops.',
    obscure: 'A culinary fruit that few people recognize and rarely encounter.',
    not: 'A non-fruit, culinary vegetable, prepared product, or instruction rather than a fruit name.',
  },
}
