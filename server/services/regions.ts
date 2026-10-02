import { readFileSync } from 'node:fs'
import { isObject } from '../../src/services/validation.ts'

export function loadRegion(
  path: string,
  id: string,
): { id: string; prompt: string } {
  const definitions: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (!isObject(definitions) || Object.keys(definitions).length === 0)
    throw new Error('Region prompts must be a nonempty object.')
  for (const [key, prompt] of Object.entries(definitions)) {
    if (
      !/^[a-z][a-z0-9_-]*$/.test(key) ||
      typeof prompt !== 'string' ||
      !prompt.trim() ||
      prompt.length > 6000
    )
      throw new Error(
        'Region prompts need valid names and nonempty text of at most 6000 characters.',
      )
  }
  const prompt = definitions[id]
  if (typeof prompt !== 'string')
    throw new Error(
      'REGION must name an entry in src/questions/region_prompts.json.',
    )
  return { id, prompt }
}
