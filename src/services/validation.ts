import type { QuestionDefinition } from '../types/index.ts'
import { OBSCURITY_CHOICES } from '../types/index.ts'

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function requiredText(
  value: unknown,
  name: string,
  max: number,
): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new Error(`${name} must contain 1–${max} characters.`)
  }
  return value
}

export function parseQuestion(value: unknown): QuestionDefinition {
  if (!isObject(value)) throw new Error('A question must be an object.')
  if (typeof value.uuid !== 'string' || !/^[a-zA-Z0-9]{8}$/.test(value.uuid))
    throw new Error('Question IDs must be 8 letters or digits.')
  if (!isObject(value.criteria) || Object.keys(value.criteria).length !== 4)
    throw new Error('Provide criteria for common, uncommon, obscure, and not.')
  const criteria = {} as QuestionDefinition['criteria']
  for (const option of OBSCURITY_CHOICES)
    criteria[option] = requiredText(
      value.criteria[option],
      `${option} criteria`,
      3000,
    )
  const question: QuestionDefinition = {
    uuid: value.uuid,
    displayed_question: requiredText(
      value.displayed_question,
      'Displayed question',
      160,
    ),
    // Keep the editable base instructions intact. The server appends safety
    // guidance and the selected region when it builds the single Jev question.
    instructions: requiredText(value.instructions, 'Instructions', 6000),
    criteria,
  }
  return question
}

export function cleanAnswer(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

export function normalizeAnswer(text: string): string {
  return cleanAnswer(text).toLowerCase()
}

export function answerError(text: string): string | null {
  const cleaned = cleanAnswer(text)
  if (!cleaned) return 'Enter an answer first.'
  if (cleaned.split(' ').length > 4) return 'Max 4 words'
  if (cleaned.length > 120) return 'Max 120 characters'
  return null
}
