import type { Attempt, PlayerProfile } from '../types/index.ts'
import { isObject } from './validation.ts'

const PROFILE_KEY = 'jevrillion.player.v1'
let memory: PlayerProfile | undefined
let warning = ''

export function storageWarning(): string {
  return warning
}

export function getPlayer(): PlayerProfile {
  if (memory) return memory
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (raw) {
      const value: unknown = JSON.parse(raw)
      if (
        isObject(value) &&
        typeof value.uuid === 'string' &&
        typeof value.name === 'string' &&
        isObject(value.history) &&
        Array.isArray(value.attempts) &&
        Array.isArray(value.pendingSync)
      ) {
        memory = value as unknown as PlayerProfile
        return memory
      }
      warning =
        'Your browser history could not be read. A new local profile was created.'
    }
  } catch {
    warning =
      'Browser storage is unavailable. Progress will last only for this visit.'
  }
  memory = {
    uuid: crypto.randomUUID(),
    name: 'Curious human',
    history: {},
    attempts: [],
    pendingSync: [],
  }
  return writePlayer(memory)
}

function writePlayer(player: PlayerProfile): PlayerProfile {
  memory = player
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(player))
  } catch {
    warning =
      'Browser storage is full or unavailable. New progress may not survive a refresh.'
  }
  return player
}

export const storage = {
  player: getPlayer,
  setName: (name: string) =>
    writePlayer({ ...getPlayer(), name: name.slice(0, 32) }),
  markPlayed: (questionId: string) => {
    const player = getPlayer()
    return writePlayer({
      ...player,
      history: {
        ...player.history,
        [questionId]: {
          can_replay: false,
          plays: (player.history[questionId]?.plays ?? 0) + 1,
          lastPlayed: new Date().toISOString(),
        },
      },
    })
  },
  resetPool: () => {
    const player = getPlayer()
    return writePlayer({
      ...player,
      history: Object.fromEntries(
        Object.entries(player.history).map(([id, entry]) => [
          id,
          { ...entry, can_replay: true },
        ]),
      ),
    })
  },
  saveAttempt: (attempt: Attempt) => {
    const player = getPlayer()
    if (player.attempts.some((item) => item.id === attempt.id)) return player
    return writePlayer({
      ...player,
      attempts: [...player.attempts, attempt],
      pendingSync: [...player.pendingSync, attempt.id],
    })
  },
  markSynced: (id: string) => {
    const player = getPlayer()
    return writePlayer({
      ...player,
      pendingSync: player.pendingSync.filter((item) => item !== id),
    })
  },
}
