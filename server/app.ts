import express from 'express'
import type { ErrorRequestHandler } from 'express'
import { resolve } from 'node:path'
import type { Credentials } from '../src/types/index.ts'
import {
  answerError,
  cleanAnswer,
  isObject,
  normalizeAnswer,
  parseQuestion,
} from '../src/services/validation.ts'
import type { ServerConfig } from './config.ts'
import { projectRoot } from './config.ts'
import { AppError, validationError } from './errors.ts'
import { createJudge, checkQuestion } from './services/jev/index.ts'
import { QuestionBank } from './services/questions.ts'
import { Leaderboards } from './services/leaderboards.ts'
import { answerCandidates } from './services/spelling.ts'
import { hasScoredMatch } from '../src/services/duplicates.ts'
import { validateJevModel } from '../src/services/jev-models.ts'
import { listOpenRouterJevModels } from './services/jev/models.ts'
import type { JevModel } from '../src/services/jev-models.ts'

interface AppOptions {
  questionPath?: string
  leaderboardPath?: string
  judge?: ReturnType<typeof createJudge>
  production?: boolean
  listModels?: () => Promise<JevModel[]>
}

function credentials(body: unknown): Credentials {
  if (!isObject(body) || 'provider' in body)
    throw new AppError(400, 'validation', 'Connect OpenRouter first.')
  if (
    body.apiKey !== undefined &&
    (typeof body.apiKey !== 'string' ||
      body.apiKey.length > 512 ||
      /[\r\n]/.test(body.apiKey))
  )
    throw new AppError(400, 'validation', 'Invalid key format.')
  if (typeof body.apiKey !== 'string' || !body.apiKey.trim())
    throw new AppError(401, 'missing_key', 'Connect OpenRouter first.')
  let model: string | undefined
  if (body.model !== undefined) {
    try {
      model = validateJevModel(body.model)
    } catch {
      throw new AppError(400, 'validation', 'Choose a TypeSafe Jev model.')
    }
  }
  return { apiKey: body.apiKey.trim(), model }
}

function candidate(body: unknown): string {
  if (!isObject(body) || typeof body.answer !== 'string')
    throw new AppError(400, 'validation', 'Enter an answer.')
  const error = answerError(body.answer)
  if (error) throw new AppError(400, 'validation', error)
  return cleanAnswer(body.answer)
}

function scoredAnswers(body: Record<string, unknown>): Set<string> {
  if (body.acceptedAnswers === undefined) return new Set()
  if (!Array.isArray(body.acceptedAnswers) || body.acceptedAnswers.length > 900)
    throw new AppError(400, 'validation', 'Invalid scored-answer list.')
  const accepted = new Set<string>()
  for (const value of body.acceptedAnswers) {
    if (typeof value !== 'string' || answerError(value))
      throw new AppError(400, 'validation', 'Invalid scored-answer list.')
    accepted.add(normalizeAnswer(value))
  }
  return accepted
}

export function createApp(config: ServerConfig, options: AppOptions = {}) {
  const app = express()
  const questions = new QuestionBank(
    options.questionPath ??
      resolve(projectRoot, 'src/questions/questions.json'),
  )
  const leaderboards = new Leaderboards(
    options.leaderboardPath ??
      resolve(projectRoot, 'leaderboards/leaderboard.json'),
  )
  const judge = options.judge ?? createJudge(config)
  app.disable('x-powered-by')
  app.use((req, res, next) => {
    const hostname = req.hostname
    if (
      hostname !== '127.0.0.1' &&
      hostname !== 'localhost' &&
      hostname !== '[::1]'
    )
      return res.status(403).json({ message: 'Local access only.' })
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')
    next()
  })
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    const allowedPorts = [config.port, 5173, 4173]
    const testPort = Number(process.env.E2E_WEB_PORT)
    if (Number.isInteger(testPort) && testPort >= 1024 && testPort <= 65535)
      allowedPorts.push(testPort)
    const allowed = allowedPorts.flatMap((port) => [
      `http://127.0.0.1:${port}`,
      `http://localhost:${port}`,
    ])
    if (req.headers.origin && !allowed.includes(req.headers.origin))
      return res.status(403).json({ message: 'This origin is not allowed.' })
    if (req.headers['sec-fetch-site'] === 'cross-site')
      return res
        .status(403)
        .json({ message: 'Cross-site requests are not allowed.' })
    if (
      ['POST', 'PUT', 'PATCH'].includes(req.method) &&
      !req.is('application/json')
    )
      return res.status(415).json({ message: 'Send application/json.' })
    next()
  })
  app.use(express.json({ limit: '512kb' }))
  app.get('/api/config', (_req, res) => res.json(config.publicConfig))
  app.get('/api/models', async (_req, res) =>
    res.json(await (options.listModels ?? listOpenRouterJevModels)()),
  )
  app.get('/api/health', (_req, res) => res.json({ ok: true }))
  app.get('/api/questions', async (_req, res) =>
    res.json(await questions.list()),
  )
  app.post('/api/keys/check', async (req, res) => {
    await judge(credentials(req.body), checkQuestion, 'apple')
    res.json({ status: 'connected' })
  })
  app.post('/api/evaluate', async (req, res) => {
    const auth = credentials(req.body)
    const answer = candidate(req.body)
    const body: unknown = req.body
    if (!isObject(body) || typeof body.questionId !== 'string')
      throw new AppError(400, 'validation', 'Choose a question.')
    const question = await questions.get(body.questionId)
    const candidates = answerCandidates(answer)
    const accepted = scoredAnswers(body)
    if (
      hasScoredMatch(
        [
          candidates.originalAnswer,
          ...(candidates.correctedAnswer ? [candidates.correctedAnswer] : []),
        ],
        accepted,
        config.publicConfig.duplicateSimilarityThreshold,
      )
    )
      throw new AppError(409, 'duplicate_answer', 'Already entered.')
    res.json(await judge(auth, question, answer, candidates))
  })
  app.get('/api/leaderboards', async (req, res) => {
    const playerId =
      typeof req.query.playerId === 'string' ? req.query.playerId : undefined
    const questionId =
      typeof req.query.questionId === 'string'
        ? req.query.questionId
        : undefined
    if (!playerId && !questionId)
      throw new AppError(400, 'validation', 'Choose a player or question.')
    res.json(await leaderboards.list(playerId, questionId))
  })
  app.post('/api/leaderboards', async (req, res) =>
    res.status(201).json(await leaderboards.save(req.body)),
  )
  app.use('/api/dev', (_req, _res, next) => {
    if (!config.publicConfig.devMode)
      throw new AppError(404, 'not_found', 'Dev mode is disabled.')
    next()
  })
  app.post('/api/dev/questions', async (req, res) =>
    res.status(201).json(await questions.save(req.body)),
  )
  app.put('/api/dev/questions/:id', async (req, res) =>
    res.json(await questions.save(req.body, req.params.id)),
  )
  app.post('/api/dev/evaluate', async (req, res) => {
    const auth = credentials(req.body)
    const answer = candidate(req.body)
    const body: unknown = req.body
    let question
    try {
      question = parseQuestion(isObject(body) ? body.question : undefined)
    } catch (error) {
      throw validationError(error)
    }
    res.json(await judge(auth, question, answer))
  })
  app.use('/api', (_req, res) =>
    res
      .status(404)
      .json({ code: 'not_found', message: 'API route not found.' }),
  )
  if (options.production) {
    app.use(express.static(resolve(projectRoot, 'dist')))
    app.get('/{*path}', (_req, res) =>
      res.sendFile(resolve(projectRoot, 'dist/index.html')),
    )
  }
  const errorHandler: ErrorRequestHandler = (
    error: unknown,
    _req,
    res,
    _next,
  ) => {
    if (error instanceof AppError) {
      res
        .status(error.status)
        .json({ code: error.code, message: error.message })
      return
    }
    if (
      isObject(error) &&
      (error.type === 'entity.parse.failed' ||
        error.type === 'entity.too.large')
    ) {
      res.status(400).json({
        code: 'validation',
        message: 'Invalid or oversized JSON request.',
      })
      return
    }
    // Do not log request bodies, credentials, or raw upstream failures.
    res.status(500).json({
      code: 'server_error',
      message:
        'The local server could not complete this operation. Check that its data files are readable and writable.',
    })
  }
  app.use(errorHandler)
  return { app, questions }
}
