import { randomUUID } from 'node:crypto'
import type { QuestionDefinition } from '../../src/types/index.ts'
import { parseQuestion } from '../../src/services/validation.ts'
import { AppError, validationError } from '../errors.ts'
import { JsonFile } from './json-file.ts'

export class QuestionBank {
  private file: JsonFile<QuestionDefinition[]>
  constructor(path: string) {
    this.file = new JsonFile(path, [])
  }

  async list(): Promise<QuestionDefinition[]> {
    const raw = await this.file.read()
    if (!Array.isArray(raw)) throw new Error('Question bank must be an array.')
    const questions = raw.map((value) => parseQuestion(value))
    if (
      new Set(questions.map((question) => question.uuid)).size !==
      questions.length
    )
      throw new Error('Question IDs must be unique.')
    return questions
  }

  async get(id: string) {
    const question = (await this.list()).find((item) => item.uuid === id)
    if (!question)
      throw new AppError(
        404,
        'not_found',
        'Question not found. Reload the question bank.',
      )
    return question
  }

  async save(value: unknown, id?: string) {
    let question: QuestionDefinition
    try {
      question = parseQuestion({
        ...(typeof value === 'object' && value !== null ? value : {}),
        uuid: id ?? randomUUID().replaceAll('-', '').slice(0, 8),
      })
    } catch (error) {
      throw validationError(error)
    }
    await this.file.update((questions) => {
      if (id && !questions.some((item) => item.uuid === id))
        throw new AppError(404, 'not_found', 'Question not found.')
      if (!id && questions.some((item) => item.uuid === question.uuid))
        throw new AppError(
          409,
          'conflict',
          'ID collision. Please create the question again.',
        )
      return id
        ? questions.map((item) => (item.uuid === id ? question : item))
        : [...questions, question]
    })
    return question
  }
}
