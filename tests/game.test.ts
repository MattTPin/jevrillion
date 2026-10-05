import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  availableQuestions,
  chooseQuestion,
  Game,
} from '../src/features/play/game.ts'
import type { Evaluation } from '../src/types/index.ts'
import { evaluation, question } from './fixtures.ts'

const flush = () => new Promise<void>((resolve) => setImmediate(resolve))

test('configured round duration controls deadline and survives reset', () => {
  let now = 500
  const game = new Game(65, () => now)
  game.start(question, async () => evaluation())
  assert.equal(game.snapshot().remaining, 65)
  now += 64_001
  game.tick()
  assert.equal(game.snapshot().remaining, 1)
  now += 999
  game.tick()
  assert.equal(game.snapshot().phase, 'finished')
  game.reset()
  assert.equal(game.snapshot().remaining, 65)
  assert.throws(() => new Game(0))
})

test('rapid submissions reserve duplicates synchronously and reject >4 words locally', async () => {
  let requests = 0
  const game = new Game(150, () => 1000)
  game.start(question, async () => {
    requests++
    return evaluation()
  })
  assert.equal(game.submit('  Dragon   fruit  '), null)
  for (let i = 0; i < 10; i++)
    assert.match(game.submit('DRAGON fruit')!, /Already entered/)
  assert.equal(game.submit('one two three four five'), 'Max 4 words')
  assert.equal(game.submit('  '), 'Enter an answer first.')
  assert.equal(requests, 1)
  await flush()
  assert.equal(game.snapshot().total, 10)
  assert.equal(game.snapshot().answers[0].text, 'Dragon fruit')
})

test('a corrected spelling cannot score again after the accepted word', async () => {
  const game = new Game(150)
  game.start(question, async (answer) =>
    answer === 'strawbery'
      ? { ...evaluation('common'), acceptedAnswer: 'strawberry' }
      : evaluation('common'),
  )
  game.submit('strawberry')
  game.submit('strawbery')
  await flush()
  assert.equal(game.snapshot().total, 10)
  assert.equal(game.snapshot().answers[1].status, 'duplicate')
  assert.match(game.submit('STRAWBERRY')!, /Already entered/)
})

test('a typo that scores first reserves its corrected spelling while another request is pending', async () => {
  const pending: Record<string, (value: Evaluation) => void> = {}
  const game = new Game(150)
  game.start(
    question,
    (answer) =>
      new Promise((resolve) => {
        pending[answer] = resolve
      }),
  )
  game.submit('strawbery')
  game.submit('strawberry')
  pending.strawbery({ ...evaluation('common'), acceptedAnswer: 'strawberry' })
  await flush()
  pending.strawberry(evaluation('common'))
  await flush()
  assert.equal(game.snapshot().total, 10)
  assert.equal(game.snapshot().answers[0].status, 'done')
  assert.equal(game.snapshot().answers[1].status, 'duplicate')
  assert.match(game.submit('strawberry')!, /Already entered/)
})

test('a scoring original typo reserves its closest suggested spelling', async () => {
  let requests = 0
  const game = new Game(150)
  game.start(question, async () => {
    requests++
    return { ...evaluation('common'), suggestedAnswer: 'strawberry' }
  })
  game.submit('strawbery')
  await flush()
  assert.deepEqual(game.scoredAnswers().sort(), ['strawberry', 'strawbery'])
  assert.equal(game.submit('strawberry'), 'Already entered.')
  assert.equal(requests, 1)
  assert.equal(game.snapshot().total, 10)
})

test('server duplicate response becomes already-entered feedback without points', async () => {
  const game = new Game(150)
  game.start(question, async (answer) => {
    if (answer === 'duplicate') throw { code: 'duplicate_answer' }
    return evaluation()
  })
  game.submit('strawberry')
  await flush()
  game.submit('duplicate')
  await flush()
  assert.equal(game.snapshot().answers[1].status, 'duplicate')
  assert.equal(game.snapshot().total, 10)
})

test('truck/truk score once in either submission order without correction metadata', async () => {
  for (const [first, second] of [
    ['truck', 'truk'],
    ['truk', 'truck'],
  ]) {
    let requests = 0
    const game = new Game(150)
    game.start(question, async () => {
      requests++
      return evaluation()
    })
    game.submit(first)
    await flush()
    assert.equal(game.submit(second), 'Already entered.')
    assert.equal(game.snapshot().total, 10)
    assert.equal(requests, 1)
  }
})

test('overlapping truck/truk requests score once regardless of which finishes first', async () => {
  for (const finishOrder of [
    [0, 1],
    [1, 0],
  ]) {
    const pending: ((value: Evaluation) => void)[] = []
    const game = new Game(150)
    game.start(question, () => new Promise((resolve) => pending.push(resolve)))
    game.submit('truck')
    game.submit('truk')
    pending[finishOrder[0]](evaluation())
    await flush()
    pending[finishOrder[1]](evaluation())
    await flush()
    assert.equal(game.snapshot().total, 10)
    assert.equal(game.snapshot().answers[finishOrder[1]].status, 'duplicate')
  }
})

test('fuzzy matching uses the configured threshold and only scored answers', async () => {
  const game = new Game(150, undefined, 100)
  game.start(question, async () => evaluation())
  game.submit('truck')
  await flush()
  assert.equal(game.submit('truk'), null)
  await flush()
  assert.equal(game.snapshot().total, 20)
  const failed = new Game(150)
  failed.start(question, async (answer) =>
    evaluation(answer === 'truck' ? 'not' : 'common'),
  )
  failed.submit('truck')
  await flush()
  assert.equal(failed.submit('truk'), null)
  await flush()
  assert.equal(failed.snapshot().total, 10)
})

test('timer uses deadline; concurrent late responses finish before finalization', async () => {
  let now = 1000
  const pending: ((value: Evaluation) => void)[] = []
  const game = new Game(150, () => now)
  game.start(question, () => new Promise((resolve) => pending.push(resolve)))
  game.submit('apple')
  game.submit('pear')
  assert.equal(pending.length, 2)
  now += 30_001
  game.tick()
  assert.equal(game.snapshot().remaining, 120)
  now += 120_000
  game.tick()
  assert.equal(game.snapshot().phase, 'settling')
  assert.match(game.submit('plum')!, /Time’s up/)
  assert.equal(pending.length, 2)
  pending[1](evaluation('obscure'))
  await flush()
  assert.equal(game.snapshot().phase, 'settling')
  pending[0](evaluation())
  await flush()
  assert.equal(game.snapshot().phase, 'finished')
  assert.equal(game.snapshot().total, 60)
})

test('errors and low-confidence/invalid answers score zero without ending round', async () => {
  let now = 0
  const game = new Game(150, () => now)
  game.start(question, async (answer) => {
    if (answer === 'error') throw new Error('provider failed')
    return evaluation(
      answer === 'invalid' ? 'not' : 'common',
      answer === 'low' ? 40 : 99,
    )
  })
  game.submit('error')
  game.submit('low')
  game.submit('invalid')
  game.submit('apple')
  await flush()
  assert.equal(game.snapshot().phase, 'playing')
  assert.equal(game.snapshot().total, 10)
  assert.equal(game.snapshot().answers[0].status, 'error')
  now = 150_000
  // No interval tick needed for the deadline guard.
  assert.match(game.submit('pear')!, /Time’s up/)
  assert.equal(game.snapshot().phase, 'finished')
  game.reset()
  assert.equal(game.snapshot().phase, 'idle')
})

test('question exhaustion and replay eligibility preserve history', () => {
  const history = {
    [question.uuid]: { can_replay: false, plays: 1, lastPlayed: '2026-01-01' },
  }
  assert.equal(chooseQuestion([question], history), undefined)
  assert.equal(availableQuestions([question], history).length, 0)
  history[question.uuid].can_replay = true
  assert.equal(
    chooseQuestion([question], history, () => 0)?.uuid,
    question.uuid,
  )
  assert.equal(history[question.uuid].plays, 1)
})
