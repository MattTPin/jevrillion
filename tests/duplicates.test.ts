import { test } from 'node:test'
import assert from 'node:assert/strict'
import { answerSimilarity, hasScoredMatch } from '../src/services/duplicates.ts'
import { readConfig } from '../server/config.ts'
import { parseAttempt } from '../server/services/leaderboards.ts'
import { answerCandidates } from '../server/services/spelling.ts'
import { attempt, evaluation } from './fixtures.ts'

test('fuzzy comparisons catch truck/truk without relying on the dictionary suggestion', () => {
  const suggestion = answerCandidates('truk')
  assert.equal(suggestion.correctedAnswer, 'trek')
  assert.ok(
    Math.abs(answerSimilarity('truck', 'truk') - 95.33333333333333) < 1e-10,
  )
  for (const [a, b] of [
    ['truck', 'truk'],
    ['martha', 'marhta'],
    ['abca', 'caba'],
  ])
    assert.equal(answerSimilarity(a, b), answerSimilarity(b, a))
  assert.ok(hasScoredMatch(['truk', 'trek'], ['truck'], 95))
  assert.ok(hasScoredMatch(['truck'], ['truk', 'trek'], 95))
  assert.equal(answerSimilarity(' TRUCK  ', 'truck'), 100)
  assert.equal(answerSimilarity('grilled   cheese', 'grilled cheese'), 100)
  assert.ok(
    Math.abs(answerSimilarity('MARTHA', 'MARHTA') - 96.11111111111111) < 1e-10,
  )
  assert.ok(Math.abs(answerSimilarity('DWAYNE', 'DUANE') - 84) < 1e-10)
  assert.equal(answerSimilarity('abc', 'xyz'), 0)
  assert.equal(answerSimilarity('', 'truck'), 0)
  for (const other of ['trunk', 'train', 'car', 'bicycle'])
    assert.equal(hasScoredMatch(['truck'], [other], 95), false)
  assert.equal(hasScoredMatch(['apple'], ['pineapple'], 95), false)
})

test('configured threshold is inclusive and validated without rounding scores', () => {
  const similarity = answerSimilarity('truck', 'truk')
  assert.ok(hasScoredMatch(['truk'], ['truck'], similarity))
  assert.equal(hasScoredMatch(['truk'], ['truck'], similarity + 0.001), false)
  assert.equal(hasScoredMatch(['truk'], ['truck'], 100), false)
  assert.ok(hasScoredMatch(['truck'], ['truck'], 100))
  assert.equal(readConfig({}).publicConfig.duplicateSimilarityThreshold, 95)
  assert.equal(
    readConfig({ DUPLICATE_SIMILARITY_THRESHOLD: '97.5' }).publicConfig
      .duplicateSimilarityThreshold,
    97.5,
  )
  for (const value of ['-1', '101', 'NaN', '', '95%'])
    assert.throws(() => readConfig({ DUPLICATE_SIMILARITY_THRESHOLD: value }))
})

test('saved rounds enforce their fuzzy threshold while old retries keep exact matching', () => {
  const record = attempt()
  record.answers = ['truck', 'truk'].map((text) => ({
    id: crypto.randomUUID(),
    text,
    submittedAt: record.timestamp,
    status: 'done',
    evaluation: evaluation(),
  }))
  assert.equal(parseAttempt(record).totalScore, 20)
  assert.equal(
    parseAttempt({ ...record, duplicateSimilarityThreshold: 100 }).totalScore,
    20,
  )
  assert.throws(
    () => parseAttempt({ ...record, duplicateSimilarityThreshold: 95 }),
    /Duplicate scoring/,
  )
  record.answers[1] = {
    ...record.answers[1],
    status: 'duplicate',
    evaluation: undefined,
  }
  assert.equal(
    parseAttempt({ ...record, duplicateSimilarityThreshold: 95 }).totalScore,
    10,
  )
})
