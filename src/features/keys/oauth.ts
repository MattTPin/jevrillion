import {
  DEFAULT_JEV_MODEL,
  validateJevModel,
} from '../../services/jev-models.ts'

const PENDING_KEY = 'jevrillion.openrouter.pkce.v1'
const AUTH_URL = 'https://openrouter.ai/auth'
const EXCHANGE_URL = 'https://openrouter.ai/api/v1/auth/keys'
const MAX_AGE_MS = 10 * 60 * 1000

interface PendingLogin {
  verifier: string
  state: string
  createdAt: number
  model?: string
}

export interface OAuthCallback {
  code: string | null
  state: string | null
  error: string | null
}

export class OAuthError extends Error {}

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomValue(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)))
}

export async function createAuthorizationUrl(
  location: Pick<Location, 'origin' | 'pathname'>,
  storage: Pick<Storage, 'setItem' | 'removeItem'>,
  model = DEFAULT_JEV_MODEL,
): Promise<string> {
  storage.removeItem(PENDING_KEY)
  const verifier = randomValue()
  const state = randomValue()
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  )
  const callback = new URL(location.pathname, location.origin)
  callback.searchParams.set('state', state)
  const url = new URL(AUTH_URL)
  url.searchParams.set('callback_url', callback.href)
  url.searchParams.set('code_challenge', base64url(new Uint8Array(digest)))
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('key_label', 'JevRillion')
  storage.setItem(
    PENDING_KEY,
    JSON.stringify({
      verifier,
      state,
      createdAt: Date.now(),
      model: validateJevModel(model),
    }),
  )
  return url.href
}

// Run before React mounts, so the code leaves the address bar before any API calls.
export function takeOAuthCallback(
  location: Pick<Location, 'search' | 'pathname' | 'hash'>,
  history: Pick<History, 'replaceState' | 'state'>,
): OAuthCallback | null {
  const params = new URLSearchParams(location.search)
  if (!['code', 'state', 'error'].some((name) => params.has(name))) return null
  const callback = {
    code: params.get('code'),
    state: params.get('state'),
    error: params.get('error'),
  }
  history.replaceState(history.state, '', location.pathname + location.hash)
  return callback
}

export async function exchangeOAuthCallback(
  callback: OAuthCallback,
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  fetcher: typeof fetch = fetch,
): Promise<{ key: string; model: string }> {
  const raw = storage.getItem(PENDING_KEY)
  storage.removeItem(PENDING_KEY)
  let pending: Partial<PendingLogin> | null = null
  try {
    pending = raw ? (JSON.parse(raw) as Partial<PendingLogin>) : null
  } catch {
    // Treat malformed temporary state as a failed login.
  }
  if (!callback.state || !pending?.state || callback.state !== pending.state)
    throw new OAuthError(
      'OpenRouter sign-in could not be verified. Connect again.',
    )
  if (
    typeof pending.createdAt !== 'number' ||
    pending.createdAt > Date.now() ||
    Date.now() - pending.createdAt > MAX_AGE_MS
  )
    throw new OAuthError('OpenRouter sign-in expired. Connect again.')
  if (callback.error)
    throw new OAuthError('OpenRouter authorization was cancelled or declined.')
  if (!callback.code)
    throw new OAuthError(
      'OpenRouter did not return an authorization code. Connect again.',
    )
  if (
    typeof pending.verifier !== 'string' ||
    !/^[\w-]{43}$/.test(pending.verifier)
  )
    throw new OAuthError('The sign-in verifier is missing. Connect again.')
  let response: Response
  try {
    response = await fetcher(EXCHANGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: callback.code,
        code_verifier: pending.verifier,
        code_challenge_method: 'S256',
      }),
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    throw new OAuthError(
      'Could not reach OpenRouter to finish sign-in. Connect again.',
    )
  }
  if (!response.ok)
    throw new OAuthError(
      'OpenRouter rejected the sign-in exchange. Connect again.',
    )
  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new OAuthError('OpenRouter returned an unreadable sign-in response.')
  }
  if (
    !data ||
    typeof data !== 'object' ||
    !('key' in data) ||
    typeof data.key !== 'string' ||
    !data.key.trim()
  )
    throw new OAuthError('OpenRouter did not return a usable credential.')
  let model: string
  try {
    model = validateJevModel(pending.model ?? DEFAULT_JEV_MODEL)
  } catch {
    throw new OAuthError('The selected Jev model is invalid. Connect again.')
  }
  return { key: data.key, model }
}
