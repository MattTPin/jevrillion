import { ArrowUpRight, Award, Layers3, RefreshCw, Trophy } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { Attempt } from '../../types/index.ts'
import { api, errorMessage } from '../../services/api.ts'
import { storage } from '../../services/storage.ts'
import { mergeAttempts, syncHistory } from '../../services/history.ts'
import { Button } from '../../components/common/Button.tsx'
import { Notice } from '../../components/common/Notice.tsx'

export function LeaderboardPage({
  onPlay,
  connected,
}: {
  onPlay: () => void
  connected: boolean
}) {
  const [attempts, setAttempts] = useState<Attempt[]>(
    () => storage.player().attempts,
  )
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState('all')
  const refresh = useCallback(async () => {
    try {
      await syncHistory()
      const player = storage.player()
      const records = await api.leaderboard({ playerId: player.uuid })
      setAttempts(mergeAttempts(player.attempts, records))
      setError('')
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setLoading(false)
    }
  }, [])
  // This effect synchronizes filesystem-backed history after mounting.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh()
  }, [refresh])
  const categories = [
    ...new Map(
      attempts.map((attempt) => [
        attempt.questionId,
        attempt.displayedQuestion,
      ]),
    ).entries(),
  ]
  const filtered = attempts
    .filter((attempt) => selected === 'all' || attempt.questionId === selected)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  return (
    <main className="page history-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <Trophy size={15} /> YOUR WALL OF BRILLIANCE
          </span>
          <h1>
            A record of <span className="text-lime">curiosity.</span>
          </h1>
          <p>Every category. Every discovery. Your personal bests, all here.</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setLoading(true)
            void refresh()
          }}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />{' '}
          Refresh
        </Button>
      </div>
      {error && (
        <Notice>{error} Your locally saved scores are shown below.</Notice>
      )}
      <div className="history-stats">
        <div>
          <Trophy size={20} />
          <span>
            <b>{attempts.length}</b>rounds played
          </span>
        </div>
        <div>
          <Award size={20} />
          <span>
            <b>
              {Math.max(0, ...attempts.map((attempt) => attempt.totalScore))}
            </b>
            personal best
          </span>
        </div>
        <div>
          <Layers3 size={20} />
          <span>
            <b>{categories.length}</b>categories explored
          </span>
        </div>
      </div>
      <section className="history-list">
        <div className="history-list-header">
          <h2>Your rounds</h2>
          <label className="sr-only" htmlFor="history-filter">
            Filter by category
          </label>
          <select
            id="history-filter"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <Trophy size={42} strokeWidth={1} />
            <h2>Your story starts with a category.</h2>
            <p>Play your first round to put a score on the board.</p>
            <Button disabled={!connected} onClick={onPlay}>
              Find your first category <ArrowUpRight size={16} />
            </Button>
          </div>
        ) : (
          <div className="history-table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Category / player</th>
                  <th>When</th>
                  <th>Answers</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((attempt) => (
                  <tr key={attempt.id}>
                    <td>
                      <strong>{attempt.displayedQuestion}</strong>
                      <small>{attempt.playerName}</small>
                    </td>
                    <td>
                      {new Date(attempt.timestamp).toLocaleDateString(
                        undefined,
                        { month: 'short', day: 'numeric' },
                      )}
                      <small>
                        {new Date(attempt.timestamp).toLocaleTimeString(
                          undefined,
                          { hour: '2-digit', minute: '2-digit' },
                        )}
                      </small>
                    </td>
                    <td>
                      {
                        attempt.answers.filter(
                          (answer) =>
                            (answer.evaluation?.score.points ?? 0) > 0,
                        ).length
                      }
                    </td>
                    <td>
                      <b>{attempt.totalScore}</b>
                      <small>points</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="text-muted text-xs mt-5">
        Your browser remembers you. Resetting the question pool keeps every
        score.
      </p>
    </main>
  )
}
