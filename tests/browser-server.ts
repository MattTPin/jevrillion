import { mkdir, copyFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createApp } from '../server/app.ts'
import { projectRoot, readConfig } from '../server/config.ts'
import { readSettings } from '../server/settings.ts'
import { AppError } from '../server/errors.ts'
import { evaluation, evaluationWithProbabilities } from './fixtures.ts'

// Isolated test-only data and judge. Production never imports this file.
const directory = resolve(projectRoot, '.test-data')
await mkdir(directory, { recursive: true })
await copyFile(
  resolve(projectRoot, 'src/questions/questions.json'),
  resolve(directory, 'questions.json'),
)
await writeFile(resolve(directory, 'leaderboard.json'), '[]')
const settings = readSettings()
const config = readConfig({
  ...settings,
  DEV_MODE: 'true',
  ROUND_SECONDS: 150,
  BONUS_STEP_UP_MARGIN: 7,
  BACKEND_PORT: process.env.E2E_API_PORT ?? settings.BACKEND_PORT ?? 3001,
})
const { app } = createApp(config, {
  questionPath: resolve(directory, 'questions.json'),
  leaderboardPath: resolve(directory, 'leaderboard.json'),
  listModels: async () => [
    { id: 'typesafe/jev-1.13', name: 'Jev 1.13' },
    { id: 'typesafe/jev-1.14', name: 'Jev 1.14' },
    { id: '~typesafe/jev-latest', name: 'Jev Latest' },
  ],
  judge: async (credentials, question, answer) => {
    if (credentials.apiKey === 'invalid-key')
      throw new AppError(401, 'invalid_key', 'Invalid key.')
    if (credentials.apiKey === 'unavailable-key')
      throw new AppError(503, 'provider_unavailable', 'Provider unavailable.')
    if (answer === 'network error')
      throw new AppError(503, 'provider_unavailable', 'Provider unavailable.')
    if (answer === 'slow fruit')
      await new Promise((resolve) => setTimeout(resolve, 1600))
    if (answer === 'bonus fruit')
      return evaluationWithProbabilities(
        { common: 50, uncommon: 43, obscure: 5, not: 2 },
        config.publicConfig.scoring,
      )
    const choice =
      answer === 'wrench' ||
      question.criteria.not === 'Reject all test candidates.'
        ? 'not'
        : answer === 'guava'
          ? 'uncommon'
          : answer === 'miracle fruit'
            ? 'obscure'
            : 'common'
    const result = evaluation(choice, answer === 'maybe' ? 40 : 99, config.publicConfig.scoring)
    return answer === 'strawbery'
      ? { ...result, suggestedAnswer: 'strawberry' }
      : result
  },
})
app.listen(config.port, '127.0.0.1', () =>
  console.info('Isolated browser test server ready.'),
)
