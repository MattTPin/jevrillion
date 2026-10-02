import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  createAuthorizationUrl,
  exchangeOAuthCallback,
  takeOAuthCallback,
} from '../src/features/keys/oauth.ts'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
    values,
  }
}

async function begin() {
  const storage = memoryStorage()
  const authorization = new URL(
    await createAuthorizationUrl(
      { origin: 'http://127.0.0.1:5173', pathname: '/' },
      storage,
    ),
  )
  const callback = new URL(authorization.searchParams.get('callback_url')!)
  const pending = JSON.parse([...storage.values.values()][0]) as {
    verifier: string
    state: string
    createdAt: number
  }
  return { storage, authorization, callback, pending }
}

test('PKCE creates random S256 challenge and binds state to the local callback', async () => {
  const first = await begin()
  const second = await begin()
  assert.equal(first.authorization.origin, 'https://openrouter.ai')
  assert.equal(first.authorization.pathname, '/auth')
  assert.equal(
    first.authorization.searchParams.get('code_challenge_method'),
    'S256',
  )
  assert.equal(first.callback.origin, 'http://127.0.0.1:5173')
  assert.equal(first.callback.searchParams.get('state'), first.pending.state)
  assert.match(first.pending.verifier, /^[\w-]{43}$/)
  assert.notEqual(first.pending.verifier, second.pending.verifier)
  assert.notEqual(first.pending.state, second.pending.state)
  const challenge = createHash('sha256')
    .update(first.pending.verifier)
    .digest('base64url')
  assert.equal(
    first.authorization.searchParams.get('code_challenge'),
    challenge,
  )
  assert.equal(first.authorization.href.includes(first.pending.verifier), false)
})

test('callback URL is scrubbed before exchange; PKCE state is removed after use', async () => {
  const { storage, pending } = await begin()
  let cleaned = ''
  const callback = takeOAuthCallback(
    {
      search: `?state=${pending.state}&code=secret-code`,
      pathname: '/',
      hash: '',
    },
    {
      state: null,
      replaceState: (_state, _unused, url) => {
        cleaned = String(url)
      },
    },
  )!
  assert.equal(cleaned, '/')
  let calls = 0
  const key = await exchangeOAuthCallback(
    callback,
    storage,
    async (url, options) => {
      calls++
      assert.equal(url, 'https://openrouter.ai/api/v1/auth/keys')
      const body = JSON.parse(options!.body as string)
      assert.deepEqual(body, {
        code: 'secret-code',
        code_verifier: pending.verifier,
        code_challenge_method: 'S256',
      })
      return Response.json({ key: 'mock-ephemeral-key' })
    },
  )
  assert.deepEqual(key, {
    key: 'mock-ephemeral-key',
    model: 'typesafe/jev-1.13',
  })
  assert.equal(calls, 1)
  assert.equal(storage.values.size, 0)
})

test('selected Jev model survives the OAuth redirect and temporary state is removed', async () => {
  const storage = memoryStorage()
  await createAuthorizationUrl(
    { origin: 'http://127.0.0.1:5173', pathname: '/' },
    storage,
    'typesafe/jev-1.14',
  )
  const pending = JSON.parse([...storage.values.values()][0]) as {
    state: string
  }
  const connection = await exchangeOAuthCallback(
    { state: pending.state, code: 'fixture-code', error: null },
    storage,
    async () => Response.json({ key: 'fixture-key' }),
  )
  assert.deepEqual(connection, {
    key: 'fixture-key',
    model: 'typesafe/jev-1.14',
  })
  assert.equal(storage.values.size, 0)
})

test('invalid state, missing code/verifier, cancellation, expiry and failed exchange never yield a key', async () => {
  const cases = [
    {
      callback: { state: 'wrong', code: 'code', error: null },
      message: /verified/,
    },
    {
      callback: { state: null, code: 'code', error: null },
      message: /verified/,
    },
    { callback: { code: null, error: null }, message: /authorization code/ },
    { callback: { code: null, error: 'access_denied' }, message: /cancelled/ },
  ]
  for (const item of cases) {
    const { storage, pending } = await begin()
    let calls = 0
    await assert.rejects(
      exchangeOAuthCallback(
        { state: pending.state, ...item.callback },
        storage,
        async () => {
          calls++
          return Response.json({ key: 'bad' })
        },
      ),
      item.message,
    )
    assert.equal(calls, 0)
    assert.equal(storage.values.size, 0)
  }
  const missing = await begin()
  missing.storage.removeItem([...missing.storage.values.keys()][0])
  await assert.rejects(
    exchangeOAuthCallback(
      { state: missing.pending.state, code: 'code', error: null },
      missing.storage,
    ),
    /verified/,
  )
  const expired = await begin()
  expired.storage.setItem(
    [...expired.storage.values.keys()][0],
    JSON.stringify({ ...expired.pending, createdAt: Date.now() - 11 * 60_000 }),
  )
  await assert.rejects(
    exchangeOAuthCallback(
      { state: expired.pending.state, code: 'code', error: null },
      expired.storage,
    ),
    /expired/,
  )
  const failed = await begin()
  await assert.rejects(
    exchangeOAuthCallback(
      { state: failed.pending.state, code: 'code', error: null },
      failed.storage,
      async () => Response.json({ message: 'secret' }, { status: 403 }),
    ),
    /rejected/,
  )
  assert.equal(failed.storage.values.size, 0)
})
