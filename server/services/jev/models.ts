import type { JevModel } from '../../../src/services/jev-models.ts'
import { isJevModelId, modelOption } from '../../../src/services/jev-models.ts'
import { AppError } from '../../errors.ts'

const MODELS_URL =
  'https://openrouter.ai/api/v1/models?output_modalities=decisions&q=jev'

export function parseJevModels(value: unknown): JevModel[] {
  if (
    !value ||
    typeof value !== 'object' ||
    !('data' in value) ||
    !Array.isArray(value.data)
  )
    throw new Error('Invalid OpenRouter model catalog.')
  const models = new Map<string, JevModel>()
  for (const item of value.data) {
    if (
      !item ||
      typeof item !== 'object' ||
      !('id' in item) ||
      !isJevModelId(item.id)
    )
      continue
    const name =
      'name' in item && typeof item.name === 'string' && item.name.trim()
        ? item.name.trim().slice(0, 120)
        : modelOption(item.id).name
    models.set(item.id, { id: item.id, name })
  }
  return [...models.values()].sort((a, b) => {
    const version = /^typesafe\/jev-\d+(?:\.\d+)*$/
    return (
      Number(version.test(b.id)) - Number(version.test(a.id)) ||
      b.id.localeCompare(a.id, undefined, { numeric: true })
    )
  })
}

export async function listOpenRouterJevModels(): Promise<JevModel[]> {
  let response: Response
  try {
    response = await fetch(MODELS_URL, { signal: AbortSignal.timeout(8_000) })
  } catch {
    throw new AppError(
      503,
      'provider_unavailable',
      'Jev models could not be refreshed.',
    )
  }
  if (!response.ok)
    throw new AppError(
      503,
      'provider_unavailable',
      'Jev models could not be refreshed.',
    )
  try {
    return parseJevModels(await response.json())
  } catch {
    throw new AppError(
      502,
      'provider_response',
      'OpenRouter returned an unreadable model list.',
    )
  }
}
