import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readConfig } from '../server/config.ts'
import {
  listOpenRouterJevModels,
  parseJevModels,
} from '../server/services/jev/models.ts'
import { DEFAULT_JEV_MODEL } from '../src/services/jev-models.ts'

test('pinned Jev default can be overridden without using a moving alias', () => {
  assert.equal(DEFAULT_JEV_MODEL, 'typesafe/jev-1.13')
  assert.equal(readConfig({}).model, DEFAULT_JEV_MODEL)
  assert.equal(
    readConfig({ VITE_DEFAULT_JEV_MODEL: 'typesafe/jev-1.14' }).publicConfig
      .model,
    'typesafe/jev-1.14',
  )
  assert.throws(() =>
    readConfig({ VITE_DEFAULT_JEV_MODEL: 'typesafe/other-1' }),
  )
})

test('catalog keeps only published TypeSafe Jev family IDs', () => {
  const models = parseJevModels({
    data: [
      { id: 'other/jev-1.13', name: 'Other Jev' },
      { id: 'typesafe/other-1', name: 'Other TypeSafe model' },
      { id: 'typesafe/jev-1.13', name: 'Jev 1.13' },
      { id: 'typesafe/jev-1.14', name: 'Jev 1.14' },
      { id: '~typesafe/jev-latest', name: 'Jev Latest' },
      { id: 'typesafe/jev-1.14', name: 'Duplicate' },
      { id: 'typesafe/jev-1.13-extra/unsafe', name: 'Invalid path' },
      { id: 42 },
    ],
  })
  assert.deepEqual(
    models.map((model) => model.id),
    ['typesafe/jev-1.14', 'typesafe/jev-1.13', '~typesafe/jev-latest'],
  )
  assert.equal(
    models.some((model) => model.id === 'typesafe/jev-router'),
    false,
  )
  assert.deepEqual(
    parseJevModels({
      data: [{ id: 'typesafe/jev-router', name: 'Jev Router' }],
    }),
    [{ id: 'typesafe/jev-router', name: 'Jev Router' }],
  )
  assert.throws(() => parseJevModels({ data: null }))
})

test('discovery uses the official decisions model catalog without credentials', async (t) => {
  let calls = 0
  t.mock.method(
    globalThis,
    'fetch',
    async (url: string, options: RequestInit) => {
      calls++
      const endpoint = new URL(url)
      assert.equal(endpoint.origin, 'https://openrouter.ai')
      assert.equal(endpoint.pathname, '/api/v1/models')
      assert.equal(endpoint.searchParams.get('output_modalities'), 'decisions')
      assert.equal(endpoint.searchParams.get('q'), 'jev')
      assert.equal(options.method, undefined)
      assert.equal(options.headers, undefined)
      return Response.json({
        data: [{ id: 'typesafe/jev-1.13', name: 'Jev 1.13' }],
      })
    },
  )
  assert.deepEqual(await listOpenRouterJevModels(), [
    { id: 'typesafe/jev-1.13', name: 'Jev 1.13' },
  ])
  assert.equal(calls, 1)
})

test('model catalog errors return a safe provider error', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('sensitive upstream detail')
  })
  await assert.rejects(
    listOpenRouterJevModels(),
    (error: unknown) =>
      error instanceof Error &&
      !error.message.includes('sensitive upstream detail'),
  )
})
