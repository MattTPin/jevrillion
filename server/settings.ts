import { readFileSync } from 'node:fs'

const path = new URL('../settings.json', import.meta.url)
const keys = [
  'VITE_DEFAULT_JEV_MODEL',
  'CONFIDENCE_THRESHOLD',
  'BONUS_STEP_UP_MARGIN',
  'DUPLICATE_SIMILARITY_THRESHOLD',
  'REGION',
  'ROUND_SECONDS',
  'COMMON_POINTS',
  'UNCOMMON_POINTS',
  'OBSCURE_POINTS',
  'DEV_MODE',
  'BACKEND_PORT',
] as const

export type Settings = Partial<
  Record<(typeof keys)[number], string | number | boolean>
>

export function readSettings(): Settings {
  let value: unknown
  try {
    value = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    throw new Error('settings.json must exist and contain valid JSON.')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('settings.json must contain an object.')
  const entries = Object.entries(value)
  if (
    entries.some(
      ([key, item]) =>
        !keys.includes(key as (typeof keys)[number]) ||
        !['string', 'number', 'boolean'].includes(typeof item),
    )
  )
    throw new Error('settings.json contains an unknown or invalid setting.')
  return value as Settings
}

export function readBackendPort(settings: Settings): number {
  const port = Number(settings.BACKEND_PORT ?? 3001)
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error('BACKEND_PORT must be between 1024 and 65535.')
  return port
}
