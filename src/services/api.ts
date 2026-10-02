import type {
  Attempt,
  Credentials,
  Evaluation,
  PublicConfig,
  QuestionDefinition,
} from '../types/index.ts'
import type { JevModel } from './jev-models.ts'

export class ApiError extends Error {
  code: string
  constructor(message: string, code = 'network') {
    super(message)
    this.code = code
  }
}

async function request<T>(
  path: string,
  body?: unknown,
  method = 'POST',
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method: body === undefined ? 'GET' : method,
      headers:
        body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    })
  } catch {
    throw new ApiError(
      'The local server could not be reached. Check that npm run dev is running.',
    )
  }
  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new ApiError('The local server returned an unreadable response.')
  }
  if (!response.ok) {
    const details =
      typeof data === 'object' && data !== null
        ? (data as Record<string, unknown>)
        : {}
    throw new ApiError(
      typeof details.message === 'string'
        ? details.message
        : 'Something went wrong. Try again.',
      typeof details.code === 'string' ? details.code : 'server_error',
    )
  }
  return data as T
}

export const api = {
  config: () => request<PublicConfig>('/config'),
  questions: () => request<QuestionDefinition[]>('/questions'),
  models: () => request<JevModel[]>('/models'),
  checkKey: (credentials: Credentials) =>
    request<{ status: 'connected' }>('/keys/check', credentials),
  evaluate: (
    credentials: Credentials,
    questionId: string,
    answer: string,
    acceptedAnswers: string[],
  ) =>
    request<Evaluation>('/evaluate', {
      ...credentials,
      questionId,
      answer,
      acceptedAnswers,
    }),
  leaderboard: (filter: { playerId: string } | { questionId: string }) =>
    request<Attempt[]>(`/leaderboards?${new URLSearchParams(filter)}`),
  saveAttempt: (attempt: Attempt) => request<Attempt>('/leaderboards', attempt),
  saveQuestion: (question: QuestionDefinition, isNew = false) =>
    request<QuestionDefinition>(
      isNew ? '/dev/questions' : `/dev/questions/${question.uuid}`,
      question,
      isNew ? 'POST' : 'PUT',
    ),
  testAnswer: (
    credentials: Credentials,
    question: QuestionDefinition,
    answer: string,
  ) =>
    request<Evaluation>('/dev/evaluate', { ...credentials, question, answer }),
}

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.'
}
