import { test } from 'node:test'
import assert from 'node:assert/strict'
import { answerCandidates, editDistance } from '../server/services/spelling.ts'
import { resolveEvaluation } from '../server/services/jev/resolve.ts'
import { evaluation } from './fixtures.ts'

test('recognized English words pass through; one close typo gets one suggestion', () => {
  assert.deepEqual(answerCandidates('  strawberry  '), {
    originalAnswer: 'strawberry',
  })
  assert.deepEqual(answerCandidates('pineapple'), {
    originalAnswer: 'pineapple',
  })
  assert.deepEqual(answerCandidates('strawbery'), {
    originalAnswer: 'strawbery',
    correctedAnswer: 'strawberry',
  })
  assert.deepEqual(answerCandidates('pinapple'), {
    originalAnswer: 'pinapple',
    correctedAnswer: 'pineapple',
  })
  assert.deepEqual(answerCandidates('grilled cheeze'), {
    originalAnswer: 'grilled cheeze',
    correctedAnswer: 'grilled cheese',
  })
  assert.equal(answerCandidates('zzzzzzzzz').correctedAnswer, undefined)
  assert.equal(answerCandidates('xq').correctedAnswer, undefined)
  assert.equal(
    answerCandidates('two unknowne namess').correctedAnswer,
    undefined,
  )
  assert.equal(editDistance('strawbery', 'strawberry'), 1)
  assert.equal(editDistance('appple', 'apple'), 1)
  assert.equal(editDistance('appel', 'apple'), 1)
})

test('resolver always prefers scoring original, then scoring correction, then failed original', () => {
  const original = evaluation('uncommon')
  const morePoints = evaluation('obscure')
  const failed = evaluation('not')
  assert.deepEqual(resolveEvaluation(original, morePoints, 'strawberry'), {
    ...original,
    suggestedAnswer: 'strawberry',
  })
  assert.deepEqual(resolveEvaluation(failed, morePoints, 'strawberry'), {
    ...morePoints,
    acceptedAnswer: 'strawberry',
  })
  assert.equal(
    resolveEvaluation(failed, evaluation('common', 40), 'strawberry'),
    failed,
  )
  assert.equal(resolveEvaluation(failed), failed)
})
