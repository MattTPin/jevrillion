export function validateRoundSeconds(seconds: number): number {
  if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > 86400)
    throw new Error('ROUND_SECONDS must be a whole number between 1 and 86400.')
  return seconds
}

export function formatTime(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
