export class AppError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function validationError(error: unknown): AppError {
  return new AppError(
    400,
    'validation',
    error instanceof Error ? error.message : 'Invalid input.',
  )
}
