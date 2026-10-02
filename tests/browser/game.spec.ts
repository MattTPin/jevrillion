import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function connect(page: Page) {
  await page.route('https://openrouter.ai/auth?**', async (route) => {
    const target = new URL(route.request().url())
    const callback = new URL(target.searchParams.get('callback_url')!)
    callback.searchParams.set('code', 'fixture-authorization-code')
    await route.fulfill({
      status: 302,
      headers: { Location: callback.href },
      body: '',
    })
  })
  await page.route('https://openrouter.ai/api/v1/auth/keys', async (route) => {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    }
    if (route.request().method() === 'OPTIONS')
      await route.fulfill({ status: 204, headers })
    else await route.fulfill({ json: { key: 'fixture-oauth-key' }, headers })
  })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Let’s play' })).toBeDisabled()
  await page.getByRole('button', { name: 'Connect OpenRouter' }).click()
  await expect(page.getByRole('button', { name: 'Let’s play' })).toBeEnabled()
}
async function questionOnly(page: Page, questionId = 'f6a91c2e') {
  await page.evaluate(async (selectedQuestion) => {
    const questions = (await (await fetch('/api/questions')).json()) as {
      uuid: string
    }[]
    const player = JSON.parse(localStorage.getItem('jevrillion.player.v1')!)
    player.history = Object.fromEntries(
      questions
        .filter((question) => question.uuid !== selectedQuestion)
        .map((question) => [
          question.uuid,
          { can_replay: false, plays: 1, lastPlayed: new Date().toISOString() },
        ]),
    )
    localStorage.setItem('jevrillion.player.v1', JSON.stringify(player))
  }, questionId)
  await page.reload()
  await connect(page)
  await expect(page.getByRole('button', { name: 'Let’s play' })).toBeEnabled()
}

test('Connect lists Jev models and sends the selected version to gameplay', async ({
  page,
}) => {
  const requests: { path: string; model: string }[] = []
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (
      path !== '/api/keys/check' &&
      path !== '/api/evaluate' &&
      path !== '/api/dev/evaluate'
    )
      return
    const body = request.postDataJSON() as { model: string }
    requests.push({ path, model: body.model })
  })
  await page.route('https://openrouter.ai/auth?**', async (route) => {
    const target = new URL(route.request().url())
    const callback = new URL(target.searchParams.get('callback_url')!)
    callback.searchParams.set('code', 'fixture-authorization-code')
    await route.fulfill({
      status: 302,
      headers: { Location: callback.href },
      body: '',
    })
  })
  await page.route('https://openrouter.ai/api/v1/auth/keys', async (route) => {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    }
    if (route.request().method() === 'OPTIONS')
      await route.fulfill({ status: 204, headers })
    else await route.fulfill({ json: { key: 'fixture-oauth-key' }, headers })
  })
  await page.goto('/')
  const selector = page.getByLabel('Jev Model')
  await expect(selector).toHaveValue('typesafe/jev-1.13')
  await expect(selector.locator('option')).toHaveCount(3)
  await selector.selectOption('typesafe/jev-1.14')
  await page.getByRole('button', { name: 'Connect OpenRouter' }).click()
  await expect(page.getByRole('button', { name: 'Let’s play' })).toBeEnabled()
  await expect(selector).toHaveValue('typesafe/jev-1.14')
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  await page.getByLabel('Candidate answer', { exact: true }).fill('apple')
  await page.getByRole('button', { name: 'Test answer', exact: true }).click()
  await expect(page.locator('.test-score strong')).toBeVisible()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Your answer', exact: true })
    .fill('apple')
  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  await expect(page.locator('.total-score strong')).toHaveText('10')
  expect(requests.map((request) => request.path)).toEqual([
    '/api/keys/check',
    '/api/dev/evaluate',
    '/api/evaluate',
  ])
  expect(
    requests.every((request) => request.model === 'typesafe/jev-1.14'),
  ).toBe(true)
})

test('Connect keeps the configured default when model discovery fails', async ({
  page,
}) => {
  await page.route('**/api/models', async (route) => route.abort('failed'))
  await page.goto('/')
  const selector = page.getByLabel('Jev Model')
  await expect(selector).toHaveValue('typesafe/jev-1.13')
  await expect(selector.locator('option')).toHaveCount(1)
  await expect(
    page.getByText(
      'Model list unavailable. Your configured default is ready to use.',
    ),
  ).toBeVisible()
  await connect(page)
  await expect(page.getByRole('button', { name: 'Let’s play' })).toBeEnabled()
})

test('Connect honors the configured model override', async ({ page }) => {
  await page.route('**/api/config', async (route) => {
    const response = await route.fetch()
    await route.fulfill({
      json: { ...(await response.json()), model: 'typesafe/jev-1.14' },
    })
  })
  await page.goto('/')
  await expect(page.getByLabel('Jev Model')).toHaveValue('typesafe/jev-1.14')
})

test('OAuth connection is ephemeral across refresh while player identity persists', async ({
  page,
}) => {
  await connect(page)
  await page.getByLabel('Player name', { exact: true }).fill('Ada Curious')
  const stores = await page.evaluate(() => ({
    local: JSON.stringify(localStorage),
    session: JSON.stringify(sessionStorage),
  }))
  expect(stores.local).not.toContain('fixture-oauth-key')
  expect(stores.session).not.toContain('fixture-oauth-key')
  expect(stores.session).not.toContain('fixture-authorization-code')
  expect(stores.session).not.toContain('code_verifier')
  expect(page.url()).not.toContain('code=')
  await page.reload()
  await expect(page.getByLabel('Player name', { exact: true })).toHaveValue(
    'Ada Curious',
  )
  await expect(
    page.getByRole('button', { name: 'Play', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Connect OpenRouter' }),
  ).toBeVisible()
})

test('wrong OAuth state cannot exchange a code or unlock Play', async ({
  page,
}) => {
  let exchanges = 0
  await page.route('https://openrouter.ai/auth?**', async (route) => {
    const callback = new URL(
      new URL(route.request().url()).searchParams.get('callback_url')!,
    )
    callback.searchParams.set('state', 'incorrect-state')
    callback.searchParams.set('code', 'fixture-code')
    await route.fulfill({
      status: 302,
      headers: { Location: callback.href },
      body: '',
    })
  })
  await page.route('https://openrouter.ai/api/v1/auth/keys', async (route) => {
    exchanges++
    await route.fulfill({ json: { key: 'should-not-be-used' } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Connect OpenRouter' }).click()
  await expect(page.getByText(/sign-in could not be verified/)).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Play', exact: true }),
  ).toBeDisabled()
  expect(exchanges).toBe(0)
  expect(page.url()).not.toContain('code=')
})

for (const failure of ['exchange', 'credential'] as const) {
  test(`failed OpenRouter ${failure} leaves Play locked without exposing provider errors`, async ({
    page,
  }) => {
    await page.route('https://openrouter.ai/auth?**', async (route) => {
      const callback = new URL(
        new URL(route.request().url()).searchParams.get('callback_url')!,
      )
      callback.searchParams.set('code', 'fixture-code')
      await route.fulfill({
        status: 302,
        headers: { Location: callback.href },
        body: '',
      })
    })
    await page.route(
      'https://openrouter.ai/api/v1/auth/keys',
      async (route) => {
        const headers = {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        }
        if (route.request().method() === 'OPTIONS')
          await route.fulfill({ status: 204, headers })
        else if (failure === 'exchange')
          await route.fulfill({
            status: 403,
            json: { message: 'sensitive upstream detail' },
            headers,
          })
        else await route.fulfill({ json: { key: 'invalid-key' }, headers })
      },
    )
    await page.goto('/')
    await page.getByRole('button', { name: 'Connect OpenRouter' }).click()
    await expect(
      page.getByRole('button', { name: 'Play', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByText(
        failure === 'exchange'
          ? /rejected the sign-in exchange/
          : /did not accept this connection/,
      ),
    ).toBeVisible()
    await expect(page.getByText('sensitive upstream detail')).toHaveCount(0)
    expect(page.url()).not.toContain('code=')
  })
}
test('round handles Enter spam, word limit, pending decisions, scoring and replay reset', async ({
  page,
}) => {
  await connect(page)
  await questionOnly(page)
  const clockStart = new Date('2026-09-30T12:00:00Z')
  await page.clock.install({ time: clockStart })
  await page.clock.pauseAt(clockStart)
  await page.getByRole('button', { name: 'Let’s play' }).click()
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Name fruit.' })).toBeVisible()
  let evaluations = 0
  page.on('request', (request) => {
    if (request.url().endsWith('/api/evaluate')) evaluations++
  })
  const answer = page.getByRole('textbox', { name: 'Your answer', exact: true })
  await expect(answer).toHaveAttribute('autocomplete', 'off')
  await expect(page.locator('.timer')).toContainText('02:30')
  await answer.fill('one two three four five')
  await answer.press('Enter')
  await expect(page.getByText('Max 4 words', { exact: true })).toBeVisible()
  expect(evaluations).toBe(0)
  await answer.fill('apple')
  await answer.press('Enter')
  await answer.press('Enter')
  await answer.press('Enter')
  await answer.fill('  APPLE  ')
  await answer.press('Enter')
  await expect(page.getByText('Already entered.')).toBeVisible()
  expect(evaluations).toBe(1)
  for (const candidate of [
    'guava',
    'miracle fruit',
    'wrench',
    'maybe',
    'network error',
  ]) {
    await answer.fill(candidate)
    await answer.press('Enter')
  }
  await expect(page.locator('.total-score strong')).toHaveText('80')
  await expect(page.getByText('Not a match', { exact: true })).toBeVisible()
  await expect(page.getByText('Too uncertain', { exact: true })).toBeVisible()
  await expect(page.getByText('Couldn’t judge', { exact: true })).toBeVisible()
  await page.clock.fastForward(149_000)
  await answer.fill('slow fruit')
  await answer.press('Enter')
  await page.clock.fastForward(1_000)
  await expect(answer).toBeDisabled()
  await expect(
    page.getByText('Time’s up! Finishing the answers you already sent.'),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Nicely thought.' }),
  ).toBeVisible()
  await expect(page.locator('.total-score strong')).toHaveText('90')
  await expect(page.getByText('Score saved', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Another round' }).click()
  await expect(page.getByText('Every category, explored.')).toBeVisible()
  await page.getByRole('button', { name: 'Reset question pool' }).click()
  await expect(
    page.getByRole('button', { name: 'Start', exact: true }),
  ).toBeVisible()
  const profile = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('jevrillion.player.v1')!),
  )
  expect(profile.attempts).toHaveLength(1)
  expect(profile.history.f6a91c2e.can_replay).toBe(true)
  expect(profile.attempts[0].totalScore).toBe(90)
  expect(profile.attempts[0].roundSeconds).toBe(150)
  expect(profile.attempts[0].duplicateSimilarityThreshold).toBe(95)
  expect(profile.attempts[0].region).toBe('western')
  await page.reload()
  await page.getByRole('button', { name: 'Leaderboard', exact: true }).click()
  await expect(page.getByRole('cell', { name: '90 points' })).toBeVisible()
  await connect(page)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  const started = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('jevrillion.player.v1')!),
  )
  expect(
    Object.values(started.history).some(
      (value) => (value as { can_replay: boolean }).can_replay === false,
    ),
  ).toBe(true)
})

test('a corrected typo cannot score again after its accepted spelling', async ({
  page,
}) => {
  await connect(page)
  await questionOnly(page)
  await page.getByRole('button', { name: 'Let’s play' }).click()
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  const answer = page.getByRole('textbox', { name: 'Your answer', exact: true })
  await answer.fill('strawberry')
  await answer.press('Enter')
  await expect(page.locator('.total-score strong')).toHaveText('10')
  await answer.fill('strawbery')
  await answer.press('Enter')
  await expect(
    page.getByText('Already entered.', { exact: true }),
  ).toBeVisible()
  await expect(page.locator('.total-score strong')).toHaveText('10')
  await expect(page.locator('.score-row')).toHaveCount(1)
})

for (const [first, second] of [
  ['truck', 'truk'],
  ['truk', 'truck'],
]) {
  test(`${second} cannot score after ${first}, even with a different dictionary suggestion`, async ({
    page,
  }) => {
    await connect(page)
    await questionOnly(page, '37df5a0c')
    await page.getByRole('button', { name: 'Let’s play' }).click()
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    let evaluations = 0
    page.on('request', (request) => {
      if (request.url().endsWith('/api/evaluate')) evaluations++
    })
    const answer = page.getByRole('textbox', {
      name: 'Your answer',
      exact: true,
    })
    await answer.fill(first)
    await answer.press('Enter')
    await expect(page.locator('.total-score strong')).toHaveText('10')
    await answer.fill(second)
    await answer.press('Enter')
    await expect(
      page.getByText('Already entered.', { exact: true }),
    ).toBeVisible()
    await expect(page.locator('.total-score strong')).toHaveText('10')
    await expect(page.locator('.score-row')).toHaveCount(1)
    expect(evaluations).toBe(1)
  })
}

test('a typo accepted as written reserves its suggested spelling', async ({
  page,
}) => {
  await connect(page)
  await questionOnly(page)
  await page.getByRole('button', { name: 'Let’s play' }).click()
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  let evaluations = 0
  page.on('request', (request) => {
    if (request.url().endsWith('/api/evaluate')) evaluations++
  })
  const answer = page.getByRole('textbox', { name: 'Your answer', exact: true })
  await answer.fill('strawbery')
  await answer.press('Enter')
  await expect(page.locator('.total-score strong')).toHaveText('10')
  await answer.fill('strawberry')
  await answer.press('Enter')
  await expect(page.getByText('Already entered.')).toBeVisible()
  expect(evaluations).toBe(1)
  await expect(page.locator('.total-score strong')).toHaveText('10')
})

test('Dev editor saves criteria, validates required options, creates categories and tests unsaved drafts', async ({
  page,
}) => {
  await connect(page)
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  await page.getByLabel('Choose question').selectOption('f6a91c2e')
  await page.getByLabel('Common criteria', { exact: true }).fill('')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(
    page.getByText('common criteria must contain 1–3000 characters.'),
  ).toBeVisible()
  await page
    .getByLabel('Common criteria', { exact: true })
    .fill('Fruit familiar to most people.')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByText('Saved to the question bank.')).toBeVisible()
  await page.reload()
  await connect(page)
  await page.getByRole('button', { name: 'Dev', exact: true }).click()
  await expect(page.getByLabel('Common criteria', { exact: true })).toHaveValue(
    'Fruit familiar to most people.',
  )
  await page
    .getByRole('button', { name: 'Create question', exact: true })
    .click()
  await page
    .getByLabel('Displayed question', { exact: true })
    .fill('Name colorful foods')
  await page
    .getByLabel('Jev instructions', { exact: true })
    .fill('Does the candidate name a colorful food?')
  for (const choice of ['Common', 'Uncommon', 'Obscure', 'Not']) {
    await page
      .getByLabel(choice + ' criteria', { exact: true })
      .fill(choice + ' colorful food criteria.')
  }
  await page
    .getByRole('button', { name: 'Save new question', exact: true })
    .click()
  await expect(page.getByText('Saved to the question bank.')).toBeVisible()
  await expect(page.getByLabel('Choose question')).not.toHaveValue('new')
  await page
    .getByLabel('Not criteria', { exact: true })
    .fill('Reject all test candidates.')
  for (const textbox of await page.getByRole('textbox').all())
    await expect(textbox).toHaveAttribute('autocomplete', 'off')
  await page.getByLabel('Candidate answer', { exact: true }).fill('apple')
  await page.getByRole('button', { name: 'Test answer', exact: true }).click()
  await expect(page.locator('.test-score strong')).toHaveText('Not a match')
  await expect(page.locator('.test-result pre')).toContainText(
    '"choice": "not"',
  )
})

test('Dev mode hidden and narrow viewport remains usable', async ({ page }) => {
  await page.route('**/api/config', async (route) => {
    const response = await route.fetch()
    const config = await response.json()
    await route.fulfill({
      json: {
        ...config,
        devMode: false,
      },
    })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(
    page.getByRole('button', { name: 'Dev', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Play', exact: true }),
  ).toBeDisabled()
  await expect(page.getByLabel('Player name', { exact: true })).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

test('failed score writes remain queued and retry after a refresh', async ({
  page,
}) => {
  await connect(page)
  await questionOnly(page)
  await page.clock.install()
  await page.route('**/api/leaderboards', async (route) => {
    if (route.request().method() === 'POST') await route.abort('failed')
    else await route.continue()
  })
  await page.getByRole('button', { name: 'Let’s play' }).click()
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Your answer', exact: true })
    .fill('apple')
  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  await expect(page.locator('.total-score strong')).toHaveText('10')
  await page.clock.fastForward(150_000)
  await expect(
    page.getByText('Saved in this browser. Server sync needs a retry.'),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('jevrillion.player.v1')!).pendingSync
          .length,
    ),
  ).toBe(1)
  await page.unroute('**/api/leaderboards')
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Play', exact: true }),
  ).toBeDisabled()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('jevrillion.player.v1')!).pendingSync
            .length,
      ),
    )
    .toBe(0)
  await page.getByRole('button', { name: 'Leaderboard', exact: true }).click()
  await expect(page.getByRole('cell', { name: '10 points' })).toHaveCount(1)
})
