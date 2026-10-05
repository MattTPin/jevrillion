import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoreDecision, validateScoringSettings } from '../src/services/scoring.ts'
import { readConfig } from '../server/config.ts'
import { createJudge } from '../server/services/jev/index.ts'
import { parseSavedEvaluation } from '../server/services/saved-evaluations.ts'
import { parseAttempt } from '../server/services/leaderboards.ts'
import { resolveEvaluation } from '../server/services/jev/resolve.ts'
import {
  attempt,
  evaluation,
  evaluationWithProbabilities,
  question,
  scoring,
} from './fixtures.ts'

test('bonus margin defaults to seven percentage points and accepts settings overrides', () => {
  assert.equal(readConfig({}).publicConfig.scoring.bonusStepUpMargin, 7)
  for (const margin of [0, 7, 15, 100]) {
    assert.equal(
      readConfig({ BONUS_STEP_UP_MARGIN: String(margin) })
        .publicConfig.scoring.bonusStepUpMargin,
      margin,
    )
  }
  for (const margin of [-1, 101, NaN, Infinity]) {
    assert.throws(() =>
      validateScoringSettings({ ...scoring, bonusStepUpMargin: margin }),
    )
    assert.throws(() => readConfig({ BONUS_STEP_UP_MARGIN: String(margin) }))
  }
  assert.throws(() => readConfig({ BONUS_STEP_UP_MARGIN: '' }))
})

test('a seven-point gap promotes common to uncommon and uncommon to obscure', () => {
  const common = evaluationWithProbabilities({
    common: 50, uncommon: 43, obscure: 5, not: 2,
  })
  assert.equal(common.decision.choice, 'common')
  assert.deepEqual(common.score, {
    choice: 'uncommon', label: 'Uncommon', points: 20, reason: 'scored',
    stepUp: { from: 'common', probabilityGap: 7 },
  })
  const uncommon = evaluationWithProbabilities({
    common: 5, uncommon: 50, obscure: 43, not: 2,
  }, { ...scoring, points: { common: 3, uncommon: 9, obscure: 77 } })
  assert.equal(uncommon.score.label, 'Obscure')
  assert.equal(uncommon.score.points, 77)
  assert.deepEqual(uncommon.score.stepUp, {
    from: 'uncommon', probabilityGap: 7,
  })
})

test('the supplied ten-point example steps up only with a sufficiently large margin', () => {
  const probabilities = { common: 50, uncommon: 40, obscure: 8, not: 2 }
  assert.equal(evaluationWithProbabilities(probabilities).score.label, 'Common')
  const promoted = evaluationWithProbabilities(
    probabilities, { ...scoring, bonusStepUpMargin: 15 },
  )
  assert.equal(promoted.score.label, 'Uncommon')
  assert.equal(promoted.score.stepUp?.probabilityGap, 10)
  const disabled = evaluationWithProbabilities(
    { common: 50, uncommon: 43, obscure: 5, not: 2 },
    { ...scoring, bonusStepUpMargin: 0 },
  )
  assert.equal(disabled.score.label, 'Common')
  assert.equal(disabled.score.stepUp, undefined)
})

test('margin is inclusive, handles floating point gaps, and does not promote beyond it', () => {
  const atBoundary = evaluationWithProbabilities({
    common: 51.1, uncommon: 44.1, obscure: 2.8, not: 2,
  })
  assert.equal(atBoundary.score.label, 'Uncommon')
  const outside = evaluationWithProbabilities({
    common: 50, uncommon: 42.99, obscure: 5.01, not: 2,
  })
  assert.equal(outside.score.label, 'Common')
  assert.equal(outside.score.stepUp, undefined)
})

test('promotion never cascades, skips a tier, or selects a zero-probability label', () => {
  assert.equal(evaluationWithProbabilities({
    common: 36, uncommon: 33, obscure: 29, not: 2,
  }).score.label, 'Uncommon')
  assert.equal(evaluationWithProbabilities({
    common: 48, uncommon: 4, obscure: 46, not: 2,
  }).score.label, 'Common')
  assert.equal(evaluationWithProbabilities({
    common: 5, uncommon: 43, obscure: 50, not: 2,
  }).score.stepUp, undefined)
  assert.equal(evaluationWithProbabilities({
    common: 99, uncommon: 0, obscure: 0, not: 1,
  }, { ...scoring, bonusStepUpMargin: 100 }).score.label, 'Common')
  const tie = evaluationWithProbabilities({
    common: 33, uncommon: 33, obscure: 32, not: 2,
  })
  assert.equal(tie.score.label, 'Uncommon')
  assert.equal(tie.score.stepUp?.from, 'common')
})

test('bonus cannot rescue rejection or insufficient combined category probability', () => {
  const atThreshold = { common: 60, uncommon: 20, obscure: 10, not: 10 }
  assert.equal(
    evaluationWithProbabilities(atThreshold).score.reason,
    'low-confidence',
  )
  assert.equal(evaluationWithProbabilities({
    common: 60.01, uncommon: 20, obscure: 10, not: 9.99,
  }).score.label, 'Common')
  const below = evaluationWithProbabilities({
    common: 43, uncommon: 40, obscure: 5, not: 12,
  })
  assert.equal(below.score.points, 0)
  assert.equal(below.score.stepUp, undefined)
  for (const probabilities of [
    { common: 20, uncommon: 19, obscure: 18, not: 43 },
    { common: 45, uncommon: 10, obscure: 0, not: 45 },
  ]) {
    const result = scoreDecision(
      { probabilities },
      { ...scoring, confidenceThreshold: 0, bonusStepUpMargin: 100 },
    )
    assert.equal(result.reason, 'invalid')
    assert.equal(result.stepUp, undefined)
  }
})

test('saved bonuses recompute from snapshots and old scores keep V2 rules', () => {
  const promoted = evaluationWithProbabilities({
    common: 50, uncommon: 43, obscure: 5, not: 2,
  })
  const restored = parseSavedEvaluation({
    ...promoted, score: { points: 999, choice: 'obscure' },
  })
  assert.deepEqual(restored.score, promoted.score)
  assert.equal('version' in restored && restored.version, 3)
  const record = attempt()
  record.answers[0].evaluation = promoted
  assert.equal(parseAttempt(record).totalScore, 20)

  const { bonusStepUpMargin: _margin, ...oldSettings } = scoring
  const historical = { ...promoted, version: 2, scoring: oldSettings }
  assert.equal(parseSavedEvaluation(historical).score.points, 0)
  assert.equal(parseSavedEvaluation({
    ...evaluation(), version: 2, scoring: oldSettings,
  }).score.points, 10)
  assert.equal(parseSavedEvaluation({
    ...evaluation('common', 90), version: 2, scoring: oldSettings,
  }).score.points, 0)
  assert.throws(() => parseSavedEvaluation({
    ...promoted, scoring: oldSettings,
  }))
  assert.throws(() => parseSavedEvaluation({
    ...promoted, scoring: { ...scoring, bonusStepUpMargin: '7' },
  }))
})

test('OpenRouter judge returns the awarded bonus while preserving the actual Jev choice', async (t) => {
  const decision = evaluationWithProbabilities({
    common: 50, uncommon: 43, obscure: 5, not: 2,
  }).decision.raw
  let requests = 0
  t.mock.method(globalThis, 'fetch', async () => {
    requests++
    return Response.json({
      model: decision.model, answers: { obscurity: decision.answer },
    })
  })
  const result = await createJudge(readConfig({}))(
    { apiKey: 'fixture-key' }, question, 'apple',
  )
  assert.equal(requests, 1)
  assert.equal(result.version, 3)
  assert.equal(result.scoring.bonusStepUpMargin, 7)
  assert.equal(result.decision.choice, 'common')
  assert.equal(result.score.choice, 'uncommon')
  assert.equal(result.score.points, 20)
})

test('a promoted original still takes priority over a higher-scoring spelling correction', () => {
  const original = evaluationWithProbabilities({
    common: 50, uncommon: 43, obscure: 5, not: 2,
  })
  const result = resolveEvaluation(original, evaluation('obscure'), 'strawberry')
  assert.equal(result.score.points, 20)
  assert.equal(result.acceptedAnswer, undefined)
  assert.equal(result.suggestedAnswer, 'strawberry')
  assert.deepEqual(result.score.stepUp, original.score.stepUp)
})
