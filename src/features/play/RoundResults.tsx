import { ArrowRight, RotateCcw, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Attempt, RoundState } from '../../types/index.ts'
import { api, errorMessage } from '../../services/api.ts'
import { mergeAttempts } from '../../services/history.ts'
import { Button } from '../../components/common/Button.tsx'
import { Notice } from '../../components/common/Notice.tsx'
import { Scoreboard } from './Scoreboard.tsx'

export function RoundResults({
  round,
  attempt,
  saveStatus,
  onRetry,
  onAgain,
}: {
  round: RoundState
  attempt: Attempt | null
  saveStatus: string
  onRetry: () => void
  onAgain: () => void
}) {
  const [leaders, setLeaders] = useState<Attempt[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!round.question) return
    let cancelled = false
    void api
      .leaderboard({ questionId: round.question.uuid })
      .then(
        (records) => {
          if (!cancelled) {
            setError('')
            setLeaders(
              mergeAttempts(attempt ? [attempt] : [], records).sort(
                (a, b) =>
                  b.totalScore - a.totalScore ||
                  a.timestamp.localeCompare(b.timestamp),
              ),
            )
          }
        },
        (reason) => {
          if (!cancelled) setError(errorMessage(reason))
        },
      )
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [round.question, attempt, retry])
  const rank = leaders.findIndex((item) => item.id === round.id) + 1
  return (
    <div className="round-layout results-layout">
      <section className="results-main">
        <span className="eyebrow">
          <Trophy size={15} /> THAT’S YOUR ROUND
        </span>
        <h1>
          Nicely <span className="text-lime">thought.</span>
        </h1>
        <p className="text-muted">
          Your take on{' '}
          <strong className="text-bright">
            {round.question?.displayed_question}
          </strong>
        </p>
        <div className="result-summary">
          <span className="result-number">
            {round.total}
            <small>points</small>
          </span>
          <span className="result-divider" />
          <p>
            {loading ? (
              'Finding your place…'
            ) : rank > 0 ? (
              <>
                Rank <strong>#{rank}</strong> of {leaders.length}
                <br />
                <small>among local attempts in this category</small>
              </>
            ) : (
              'Your round is complete.'
            )}
          </p>
        </div>
        <div className="category-leaderboard">
          <div className="flex justify-between items-center gap-3 mb-4">
            <h2>Category leaderboard</h2>
            <span className="mini-tag">LOCAL LEGENDS</span>
          </div>
          {error ? (
            <>
              <Notice>{error}</Notice>
              <Button
                className="mt-3"
                variant="ghost"
                onClick={() => setRetry(retry + 1)}
              >
                Retry leaderboard
              </Button>
            </>
          ) : (
            leaders.slice(0, 5).map((record, index) => (
              <div
                key={record.id}
                className={`leader-row ${record.id === round.id ? 'is-you' : ''}`}
              >
                <span className="rank">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span>
                  {record.playerName}
                  {record.id === round.id && <small> this round</small>}
                </span>
                <b>
                  {record.totalScore}
                  <small> pts</small>
                </b>
              </div>
            ))
          )}
        </div>
        <div className="flex items-center flex-wrap gap-4 mt-7">
          <Button onClick={onAgain}>
            Another round <ArrowRight size={17} />
          </Button>
          <span className="text-xs text-muted" role="status">
            {saveStatus}
          </span>
          {saveStatus !== 'Score saved' && !saveStatus.includes('Saving') && (
            <Button variant="ghost" onClick={onRetry}>
              <RotateCcw size={14} /> Retry save
            </Button>
          )}
        </div>
      </section>
      <Scoreboard answers={round.answers} total={round.total} final />
    </div>
  )
}
