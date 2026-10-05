export const SCORING_CHOICES = ['common', 'uncommon', 'obscure'] as const
export const OBSCURITY_CHOICES = [...SCORING_CHOICES, 'not'] as const
export type ScoringChoice = (typeof SCORING_CHOICES)[number]
export type ObscurityChoice = (typeof OBSCURITY_CHOICES)[number]
export interface ScoringSettings {
  confidenceThreshold: number
  bonusStepUpMargin: number // Percentage points; zero disables tier promotion.
  points: Record<ScoringChoice, number>
}

export interface QuestionDefinition {
  uuid: string
  displayed_question: string
  instructions: string
  criteria: Record<ObscurityChoice, string>
}

export interface PublicConfig {
  model: string
  scoring: ScoringSettings
  roundSeconds: number
  duplicateSimilarityThreshold: number
  region: { id: string; prompt: string }
  devMode: boolean
}

export interface Credentials {
  apiKey: string
  model?: string
}

export type ConnectionStatus =
  'unchecked' | 'checking' | 'connected' | 'invalid' | 'unavailable'
export type Rarity = 'Common' | 'Uncommon' | 'Obscure'

export interface JevDecision {
  choice: ObscurityChoice
  confidence: number // Overall model confidence, normalized to 0–100; diagnostic only.
  probabilities: Record<ObscurityChoice, number> // Per-choice probabilities, 0–100.
  raw: {
    model: string
    answer: {
      type: 'choice'
      choice: ObscurityChoice
      confidence: number
      probabilities: Record<ObscurityChoice, number>
    }
  }
}

export interface ScoreResult {
  choice: ObscurityChoice
  label: Rarity | null
  points: number
  reason: 'scored' | 'invalid' | 'low-confidence'
  stepUp?: { from: ScoringChoice; probabilityGap: number }
}

export interface Evaluation {
  version: 2 | 3 // V2 history retains the previous single-label threshold.
  decision: JevDecision
  score: ScoreResult
  scoring: ScoringSettings
  region: string
  /** Present only when a corrected spelling rescued the submission. */
  acceptedAnswer?: string
  /** Closest spelling when the original answer itself scored. */
  suggestedAnswer?: string
}

// Read-only compatibility for existing scores and pending browser writes.
// New gameplay never uses these V1 rules or makes validity-only requests.
export interface LegacyEvaluation {
  decision: {
    valid: boolean
    confidence: number
    raw: {
      model: string
      answer: {
        type: 'choice'
        choice: 'valid' | 'invalid'
        confidence: number
        probabilities: Record<'valid' | 'invalid', number>
      }
    }
  }
  score: Omit<ScoreResult, 'choice'>
  cutoffs: { common: number; uncommon: number }
}

export interface SubmittedAnswer {
  id: string
  text: string
  submittedAt: string
  status: 'pending' | 'done' | 'error' | 'duplicate'
  evaluation?: Evaluation
  error?: string
}

export interface Attempt {
  id: string
  playerId: string
  playerName: string
  questionId: string
  displayedQuestion: string
  totalScore: number
  timestamp: string
  answers: (Omit<SubmittedAnswer, 'evaluation'> & {
    evaluation?: Evaluation | LegacyEvaluation
  })[]
  roundSeconds?: number
  duplicateSimilarityThreshold?: number
  region?: string
}

export interface PlayerProfile {
  uuid: string
  name: string
  history: Record<
    string,
    { can_replay: boolean; plays: number; lastPlayed: string }
  >
  attempts: Attempt[]
  pendingSync: string[]
}

export type RoundPhase = 'idle' | 'playing' | 'settling' | 'finished'

export interface RoundState {
  id: string
  phase: RoundPhase
  question: QuestionDefinition | null
  deadline: number
  duration: number
  remaining: number
  answers: SubmittedAnswer[]
  total: number
}
