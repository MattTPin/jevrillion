import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type {
  Attempt,
  Credentials,
  QuestionDefinition,
  PublicConfig,
} from '../../types/index.ts'
import { api, errorMessage } from '../../services/api.ts'
import { storage } from '../../services/storage.ts'
import { syncHistory } from '../../services/history.ts'
import { chooseQuestion, Game } from './game.ts'

export function useGame(
  questions: QuestionDefinition[],
  credentials: Credentials,
  config: PublicConfig,
) {
  const [game] = useState(
    () =>
      new Game(
        config.roundSeconds,
        undefined,
        config.duplicateSimilarityThreshold,
      ),
  )
  const round = useSyncExternalStore(game.subscribe, game.snapshot)
  const [saveStatus, setSaveStatus] = useState('')
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const savedRound = useRef('')
  const roundPlayer = useRef({ uuid: '', name: '' })
  const active = round.phase === 'playing' || round.phase === 'settling'

  useEffect(() => {
    if (!active) return
    const interval = window.setInterval(game.tick, 100)
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warnBeforeLeave)
    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeunload', warnBeforeLeave)
    }
  }, [active, game])

  useEffect(() => {
    if (
      round.phase !== 'finished' ||
      !round.question ||
      savedRound.current === round.id
    )
      return
    savedRound.current = round.id
    const record: Attempt = {
      id: round.id,
      playerId: roundPlayer.current.uuid,
      playerName: roundPlayer.current.name.trim() || 'Curious human',
      questionId: round.question.uuid,
      displayedQuestion: round.question.displayed_question,
      totalScore: round.total,
      timestamp: new Date().toISOString(),
      answers: round.answers,
      roundSeconds: round.duration,
      duplicateSimilarityThreshold: config.duplicateSimilarityThreshold,
      region: config.region.id,
    }
    storage.saveAttempt(record)
    setAttempt(record)
    setSaveStatus('Saving your score…')
    void syncHistory().then(
      () => setSaveStatus('Score saved'),
      () => setSaveStatus('Saved in this browser. Server sync needs a retry.'),
    )
  }, [round, config.region.id, config.duplicateSimilarityThreshold])

  const start = () => {
    const player = storage.player()
    const question = chooseQuestion(questions, player.history)
    if (!question) return false
    roundPlayer.current = { uuid: player.uuid, name: player.name }
    if (
      !game.start(question, (answer) =>
        api.evaluate(credentials, question.uuid, answer, game.scoredAnswers()),
      )
    )
      return false
    storage.markPlayed(question.uuid)
    setAttempt(null)
    setSaveStatus('')
    return true
  }

  const retrySave = async () => {
    setSaveStatus('Saving your score…')
    try {
      await syncHistory()
      setSaveStatus('Score saved')
    } catch (error) {
      setSaveStatus(errorMessage(error))
    }
  }

  return {
    round,
    active,
    start,
    submit: (text: string) => game.submit(text),
    reset: () => game.reset(),
    attempt,
    saveStatus,
    retrySave,
  }
}
