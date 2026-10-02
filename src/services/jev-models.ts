export const DEFAULT_JEV_MODEL = 'typesafe/jev-1.13'

export interface JevModel {
  id: string
  name: string
}

// OpenRouter's Jev Decisions models, including explicitly listed aliases.
export function isJevModelId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^~?typesafe\/jev-[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(value)
  )
}

export function validateJevModel(value: unknown): string {
  if (!isJevModelId(value))
    throw new Error('VITE_DEFAULT_JEV_MODEL must be a TypeSafe Jev model ID.')
  return value
}

export function modelOption(id: string): JevModel {
  return { id, name: id.replace(/^~?typesafe\/jev-/, 'Jev ') }
}
