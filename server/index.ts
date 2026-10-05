import { createApp } from './app.ts'
import { readConfig } from './config.ts'

try {
  const config = readConfig()
  const { app, questions } = createApp(config, {
    production: process.argv.includes('--production'),
  })
  await questions.list() // Validate every category and its four criteria at startup.
  const server = app.listen(config.port, '127.0.0.1', () => {
    console.info(`JevRillion local server: http://127.0.0.1:${config.port}`)
    console.info(
      `Dev mode: ${config.publicConfig.devMode ? 'enabled' : 'disabled'}`,
    )
  })
  server.on('error', () => {
    console.error(
      'Server could not start. Check that BACKEND_PORT is available.',
    )
    process.exitCode = 1
  })
} catch (error) {
  console.error('Startup configuration or question-bank validation failed.')
  // Only our validation messages, never settings values or upstream errors.
  if (
    error instanceof Error &&
    /^(Scoring|CONFIDENCE_THRESHOLD|BONUS_STEP_UP_MARGIN|DUPLICATE_SIMILARITY_THRESHOLD|COMMON_POINTS|UNCOMMON_POINTS|OBSCURE_POINTS|ROUND_SECONDS|REGION|Region|DEV_MODE|BACKEND_PORT|VITE_DEFAULT_JEV_MODEL|settings\.json|Question|A question|Provide |Displayed question|Instructions|common criteria|uncommon criteria|obscure criteria|not criteria)/.test(
      error.message,
    )
  )
    console.error(error.message)
  process.exitCode = 1
}
