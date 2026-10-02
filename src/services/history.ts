import type { Attempt } from '../types/index.ts'
import { api } from './api.ts'
import { storage } from './storage.ts'

// One shared queue prevents StrictMode, results, and history refreshes from
// writing the same attempt concurrently. The backend is idempotent too.
let syncing: Promise<void> | null = null
export function syncHistory(): Promise<void> {
  if (syncing) return syncing
  syncing = (async () => {
    while (storage.player().pendingSync.length) {
      const player = storage.player()
      const id = player.pendingSync[0]
      const attempt = player.attempts.find((item) => item.id === id)
      if (attempt) await api.saveAttempt(attempt)
      storage.markSynced(id)
    }
  })().finally(() => {
    syncing = null
  })
  return syncing
}

export function mergeAttempts(local: Attempt[], remote: Attempt[]): Attempt[] {
  const byId = new Map(local.map((attempt) => [attempt.id, attempt]))
  remote.forEach((attempt) => byId.set(attempt.id, attempt))
  return [...byId.values()].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp),
  )
}
