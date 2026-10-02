import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import type { PublicConfig } from '../src/types/index.ts'
import { validateScoringSettings } from '../src/services/scoring.ts'
import { loadRegion } from './services/regions.ts'
import { validateRoundSeconds } from '../src/services/timing.ts'
import {
  DEFAULT_DUPLICATE_SIMILARITY_THRESHOLD,
  validateDuplicateThreshold,
} from '../src/services/duplicates.ts'
import {
  DEFAULT_JEV_MODEL,
  validateJevModel,
} from '../src/services/jev-models.ts'
import { readBackendPort, readSettings } from './settings.ts'
import type { Settings } from './settings.ts'

export const projectRoot = fileURLToPath(new URL('../', import.meta.url))

export function readConfig(
  settings: Settings | Record<string, string | number | boolean | undefined> =
    readSettings(),
) {
  const read = (name: string, fallback = '') =>
    String(settings[name as keyof Settings] ?? fallback)
  const dev = read('DEV_MODE', 'false').toLowerCase()
  if (dev !== 'true' && dev !== 'false')
    throw new Error('DEV_MODE must be true or false.')
  const numeric = (name: string, fallback: string) => {
    const value = read(name, fallback)
    if (!value.trim() || !Number.isFinite(Number(value)))
      throw new Error(`${name} must be a finite number.`)
    return Number(value)
  }
  const scoring = validateScoringSettings({
    confidenceThreshold: numeric('CONFIDENCE_THRESHOLD', '90'),
    points: {
      common: numeric('COMMON_POINTS', '10'),
      uncommon: numeric('UNCOMMON_POINTS', '20'),
      obscure: numeric('OBSCURE_POINTS', '50'),
    },
  })
  const roundSeconds = validateRoundSeconds(numeric('ROUND_SECONDS', '90'))
  const duplicateSimilarityThreshold = validateDuplicateThreshold(
    numeric(
      'DUPLICATE_SIMILARITY_THRESHOLD',
      String(DEFAULT_DUPLICATE_SIMILARITY_THRESHOLD),
    ),
  )
  const region = loadRegion(
    resolve(projectRoot, 'src/questions/region_prompts.json'),
    read('REGION', 'western'),
  )
  const port = readBackendPort(settings)
  const model = validateJevModel(
    read('VITE_DEFAULT_JEV_MODEL', DEFAULT_JEV_MODEL).trim(),
  )
  const publicConfig: PublicConfig = {
    model,
    scoring,
    roundSeconds,
    duplicateSimilarityThreshold,
    region,
    devMode: dev === 'true',
  }
  return { port, model, publicConfig }
}

export type ServerConfig = ReturnType<typeof readConfig>
