import type {
  Evaluation,
  PlayerProfile,
  QuestionDefinition,
  RoundState,
  SubmittedAnswer,
} from '../../types/index.ts'
import {
  answerError,
  cleanAnswer,
  normalizeAnswer,
} from '../../services/validation.ts'

import { validateRoundSeconds } from '../../services/timing.ts'
import {
  DEFAULT_DUPLICATE_SIMILARITY_THRESHOLD,
  hasScoredMatch,
  validateDuplicateThreshold,
} from '../../services/duplicates.ts'

export function availableQuestions(
  questions: QuestionDefinition[],
  history: PlayerProfile['history'],
): QuestionDefinition[] {
  return questions.filter(
    (question) => history[question.uuid]?.can_replay !== false,
  )
}

export function chooseQuestion(
  questions: QuestionDefinition[],
  history: PlayerProfile['history'],
  random = Math.random,
): QuestionDefinition | undefined {
  const available = availableQuestions(questions, history)
  return available[Math.floor(random() * available.length)]
}

const initial = (duration: number): RoundState => ({
  id: '',
  phase: 'idle',
  question: null,
  deadline: 0,
  duration,
  remaining: duration,
  answers: [],
  total: 0,
})

// Framework-independent round state. The deadline is absolute, so tab throttling
// and slow decisions cannot add time. Each answer reserves its duplicate key
// synchronously, before the first await or React render.
export class Game {
  private state: RoundState
  private listeners = new Set<() => void>()
  private seen = new Set<string>()
  private accepted = new Set<string>()
  private evaluate: ((answer: string) => Promise<Evaluation>) | undefined
  private now: () => number
  private duplicateSimilarityThreshold: number
  constructor(
    duration: number,
    now: () => number = () => Date.now(),
    duplicateSimilarityThreshold = DEFAULT_DUPLICATE_SIMILARITY_THRESHOLD,
  ) {
    this.now = now
    this.duplicateSimilarityThreshold = validateDuplicateThreshold(
      duplicateSimilarityThreshold,
    )
    this.state = initial(validateRoundSeconds(duration))
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  snapshot = () => this.state
  scoredAnswers = () => [...this.accepted]

  private update(state: RoundState) {
    this.state = state
    this.listeners.forEach((listener) => listener())
  }

  start(
    question: QuestionDefinition,
    evaluate: (answer: string) => Promise<Evaluation>,
  ): boolean {
    if (this.state.phase === 'playing' || this.state.phase === 'settling')
      return false
    this.seen.clear()
    this.accepted.clear()
    this.evaluate = evaluate
    this.update({
      ...initial(this.state.duration),
      id: crypto.randomUUID(),
      phase: 'playing',
      question,
      deadline: this.now() + this.state.duration * 1000,
    })
    return true
  }

  tick = () => {
    if (this.state.phase !== 'playing' && this.state.phase !== 'settling')
      return
    const remaining = Math.max(
      0,
      Math.ceil((this.state.deadline - this.now()) / 1000),
    )
    const pending = this.state.answers.some(
      (answer) => answer.status === 'pending',
    )
    const phase = remaining > 0 ? 'playing' : pending ? 'settling' : 'finished'
    if (remaining !== this.state.remaining || phase !== this.state.phase)
      this.update({ ...this.state, remaining, phase })
  }

  submit(text: string): string | null {
    this.tick()
    if (this.state.phase !== 'playing' || !this.evaluate)
      return 'Time’s up! Waiting for your final score.'
    const error = answerError(text)
    if (error) return error
    const normalized = normalizeAnswer(text)
    if (
      this.seen.has(normalized) ||
      hasScoredMatch(
        [normalized],
        this.accepted,
        this.duplicateSimilarityThreshold,
      )
    )
      return 'Already entered.'
    if (this.state.answers.length >= 300)
      return 'Answer limit reached for this round.'
    this.seen.add(normalized)
    const answer: SubmittedAnswer = {
      id: crypto.randomUUID(),
      text: cleanAnswer(text),
      submittedAt: new Date(this.now()).toISOString(),
      status: 'pending',
    }
    this.update({ ...this.state, answers: [...this.state.answers, answer] })
    const roundId = this.state.id
    void this.evaluate(answer.text).then(
      (evaluation) =>
        this.settle(roundId, answer.id, {
          ...answer,
          status: 'done',
          evaluation,
        }),
      (error: unknown) =>
        this.settle(
          roundId,
          answer.id,
          error !== null &&
            typeof error === 'object' &&
            'code' in error &&
            error.code === 'duplicate_answer'
            ? { ...answer, status: 'duplicate' }
            : {
                ...answer,
                status: 'error',
                error: 'Could not judge this answer. Keep going!',
              },
        ),
    )
    return null
  }

  private settle(roundId: string, id: string, result: SubmittedAnswer) {
    if (roundId !== this.state.id) return
    if (result.status === 'done' && result.evaluation?.score.points) {
      const aliases = [
        result.text,
        result.evaluation.acceptedAnswer,
        result.evaluation.suggestedAnswer,
      ]
        .filter((value): value is string => !!value)
        .map(normalizeAnswer)
      if (
        hasScoredMatch(
          aliases,
          this.accepted,
          this.duplicateSimilarityThreshold,
        )
      ) {
        result = { ...result, status: 'duplicate', evaluation: undefined }
      } else {
        for (const alias of aliases) {
          this.accepted.add(alias)
          this.seen.add(alias)
        }
      }
    }
    const answers = this.state.answers.map((answer) =>
      answer.id === id ? result : answer,
    )
    this.update({
      ...this.state,
      answers,
      total: answers.reduce(
        (total, answer) => total + (answer.evaluation?.score.points ?? 0),
        0,
      ),
    })
    this.tick()
  }

  reset() {
    if (this.state.phase === 'playing' || this.state.phase === 'settling')
      return
    this.update(initial(this.state.duration))
  }
}
