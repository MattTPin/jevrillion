import type { QuestionDefinition } from '../../../src/types/index.ts'
import { createRequest, sendDecision } from './shared.ts'

// Decisions API; this model does not use chat/completions.
// https://openrouter.ai/blog/insights/what-is-jev/
export function evaluateOpenRouter(
  apiKey: string,
  model: string,
  question: QuestionDefinition,
  answer: string,
  regionPrompt: string,
  correctedAnswer?: string,
) {
  return sendDecision(
    'https://openrouter.ai/api/alpha/decisions',
    apiKey,
    createRequest(model, question, answer, regionPrompt, correctedAnswer),
  )
}
