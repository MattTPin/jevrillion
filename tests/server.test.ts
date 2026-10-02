import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../server/app.ts'
import { readConfig } from '../server/config.ts'
import { AppError } from '../server/errors.ts'
import { JsonFile } from '../server/services/json-file.ts'
import { Leaderboards } from '../server/services/leaderboards.ts'
import { attempt, evaluation, question } from './fixtures.ts'
import type { Evaluation, QuestionDefinition } from '../src/types/index.ts'

test('real HTTP routes validate requests, gate Dev, persist edits and idempotent scores', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'jevrillion-'))
  const questionPath = join(directory, 'questions.json')
  const leaderboardPath = join(directory, 'leaderboard.json')
  await writeFile(questionPath, JSON.stringify([question]))
  let calls = 0
  const config = readConfig({ DEV_MODE: 'true' })
  const { app } = createApp(config, {
    questionPath,
    leaderboardPath,
    listModels: async () => [{ id: 'typesafe/jev-1.14', name: 'Jev 1.14' }],
    judge: async (credentials, _question, answer) => {
      calls++
      if (credentials.apiKey === 'bad')
        throw new AppError(401, 'invalid_key', 'Invalid key.')
      return evaluation(
        answer === 'wrench' ? 'not' : answer === 'guava' ? 'obscure' : 'common',
      )
    },
  })
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const base = `http://127.0.0.1:${address.port}/api`
  const send = (path: string, body: unknown, method = 'POST') =>
    fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await rm(directory, { recursive: true, force: true })
  })

  const publicConfig = await (await fetch(`${base}/config`)).text()
  assert.equal(publicConfig.includes('configuredKeys'), false)
  assert.deepEqual(await (await fetch(`${base}/models`)).json(), [
    { id: 'typesafe/jev-1.14', name: 'Jev 1.14' },
  ])
  assert.equal(
    (await send('/keys/check', { apiKey: 'fixture-key', model: 'other/model' }))
      .status,
    400,
  )
  assert.equal((await send('/keys/check', {})).status, 401)
  assert.equal((await send('/keys/check', { apiKey: 'bad' })).status, 401)
  assert.equal(
    (await send('/keys/check', { apiKey: 'fixture-key' })).status,
    200,
  )
  const before = calls
  assert.equal(
    (
      await send('/evaluate', {
        apiKey: 'fixture-key',
        questionId: question.uuid,
        answer: 'one two three four five',
      })
    ).status,
    400,
  )
  assert.equal(calls, before)
  assert.equal(
    (
      await send('/evaluate', {
        apiKey: 'fixture-key',
        questionId: 'missing!',
        answer: 'apple',
      })
    ).status,
    404,
  )
  assert.equal(
    (
      await send('/evaluate', {
        provider: 'unknown',
        questionId: question.uuid,
        answer: 'apple',
      })
    ).status,
    400,
  )
  const scored = (await (
    await send('/evaluate', {
      apiKey: 'fixture-key',
      questionId: question.uuid,
      answer: 'guava',
    })
  ).json()) as Evaluation
  assert.equal(scored.score.points, 50)

  const beforeDuplicate = calls
  for (const [answer, acceptedAnswers] of [
    ['strawbery', ['strawberry']],
    ['pinapple', ['pineapple']],
    ['strawberry', ['strawberry']],
    ['strawbery', ['strawbery']],
    ['truk', ['truck']],
    ['truck', ['truk']],
  ] as const) {
    const response = await send('/evaluate', {
      apiKey: 'fixture-key',
      questionId: question.uuid,
      answer,
      acceptedAnswers,
    })
    assert.equal(response.status, 409)
    assert.equal((await response.json()).message, 'Already entered.')
  }
  assert.equal(calls, beforeDuplicate)
  config.publicConfig.duplicateSimilarityThreshold = 100
  assert.equal(
    (
      await send('/evaluate', {
        apiKey: 'fixture-key',
        questionId: question.uuid,
        answer: 'truk',
        acceptedAnswers: ['truck'],
      })
    ).status,
    200,
  )
  assert.equal(calls, beforeDuplicate + 1)
  config.publicConfig.duplicateSimilarityThreshold = 95
  assert.equal(
    (
      await send('/evaluate', {
        apiKey: 'fixture-key',
        questionId: question.uuid,
        answer: 'pineapple',
        acceptedAnswers: ['strawberry'],
      })
    ).status,
    200,
  )
  assert.equal(calls, beforeDuplicate + 2)
  assert.equal(
    (
      await send('/evaluate', {
        apiKey: 'fixture-key',
        questionId: question.uuid,
        answer: 'pear',
        acceptedAnswers: ['bad one two three four'],
      })
    ).status,
    400,
  )

  const changed = {
    ...question,
    displayed_question: 'Name edible fruit',
    criteria: { ...question.criteria, not: 'Reject vegetables.' },
  }
  assert.equal(
    (await send(`/dev/questions/${question.uuid}`, changed, 'PUT')).status,
    200,
  )
  const diskQuestions = JSON.parse(await readFile(questionPath, 'utf8'))
  assert.equal(diskQuestions[0].criteria.not, 'Reject vegetables.')
  assert.equal(diskQuestions[0].displayed_question, changed.displayed_question)
  assert.equal(
    (
      await send(
        `/dev/questions/${question.uuid}`,
        {
          ...changed,
          criteria: { ...changed.criteria, common: 'Everyday fruit.' },
        },
        'PUT',
      )
    ).status,
    200,
  )
  assert.equal(
    (
      await send(
        `/dev/questions/${question.uuid}`,
        { ...changed, criteria: { ...changed.criteria, obscure: '' } },
        'PUT',
      )
    ).status,
    400,
  )
  const created = (await (
    await send('/dev/questions', {
      ...question,
      displayed_question: 'New question',
    })
  ).json()) as QuestionDefinition
  assert.match(created.uuid, /^[a-z0-9]{8}$/)
  assert.notEqual(created.uuid, question.uuid)
  assert.equal(
    (
      await send('/dev/evaluate', {
        apiKey: 'fixture-key',
        question: { ...question, instructions: 'Unsaved instructions' },
        answer: 'apple',
      })
    ).status,
    200,
  )

  const record = attempt()
  const responses = await Promise.all(
    Array.from({ length: 8 }, () => send('/leaderboards', record)),
  )
  responses.forEach((response) => assert.equal(response.status, 201))
  const records = await new Leaderboards(leaderboardPath).list(record.playerId)
  assert.equal(records.length, 1)
  assert.equal(records[0].totalScore, 10)
  const duplicate = {
    ...attempt(),
    answers: [
      record.answers[0],
      { ...record.answers[0], id: crypto.randomUUID(), text: 'APPLE' },
    ],
  }
  assert.equal((await send('/leaderboards', duplicate)).status, 400)
  const duplicateCorrection = {
    ...attempt(),
    answers: [
      record.answers[0],
      {
        ...record.answers[0],
        id: crypto.randomUUID(),
        text: 'appl',
        evaluation: { ...evaluation(), acceptedAnswer: 'apple' },
      },
    ],
  }
  assert.equal((await send('/leaderboards', duplicateCorrection)).status, 400)
  assert.equal(
    (
      (await (
        await fetch(`${base}/leaderboards?questionId=${question.uuid}`)
      ).json()) as unknown[]
    ).length,
    1,
  )

  const crossSite = await fetch(`${base}/keys/check`, {
    method: 'POST',
    headers: {
      Origin: 'https://untrusted.example',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ apiKey: 'fixture-key' }),
  })
  assert.equal(crossSite.status, 403)
  config.publicConfig.devMode = false
  assert.equal((await send('/dev/questions', question)).status, 404)
  assert.equal(
    (
      await send('/dev/evaluate', {
        apiKey: 'fixture-key',
        question,
        answer: 'apple',
      })
    ).status,
    404,
  )
})

test('JSON writes serialize concurrent updates and refuse to overwrite corrupt files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jevrillion-json-'))
  const path = join(directory, 'data.json')
  try {
    const file = new JsonFile<number[]>(path, [])
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        file.update((current) => [...current, i]),
      ),
    )
    assert.equal((await file.read()).length, 25)
    await writeFile(path, 'corrupted')
    await assert.rejects(file.update(() => []))
    assert.equal(await readFile(path, 'utf8'), 'corrupted')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
