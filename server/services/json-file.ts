import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'

// Serialize read-modify-write operations for this process and atomically replace
// the destination. A failed write leaves the previous JSON intact.
export class JsonFile<T> {
  private queue: Promise<unknown> = Promise.resolve()
  private path: string
  private initial: T
  constructor(path: string, initial: T) {
    this.path = path
    this.initial = initial
  }

  async read(): Promise<T> {
    try {
      return JSON.parse(await readFile(this.path, 'utf8')) as T
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      )
        return this.initial
      throw error // Never overwrite corrupt data with an empty array.
    }
  }

  update(change: (current: T) => T): Promise<T> {
    const operation = this.queue.then(async () => {
      const next = change(await this.read())
      await mkdir(dirname(this.path), { recursive: true })
      const temporary = `${this.path}.${randomUUID()}.tmp`
      try {
        await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, {
          encoding: 'utf8',
          flag: 'wx',
        })
        await rename(temporary, this.path)
      } finally {
        await rm(temporary, { force: true })
      }
      return next
    })
    this.queue = operation.catch(() => undefined)
    return operation
  }
}
