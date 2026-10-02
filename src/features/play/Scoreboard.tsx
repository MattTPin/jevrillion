import { Sparkles, Trophy } from 'lucide-react'
import type { SubmittedAnswer } from '../../types/index.ts'

export function Scoreboard({
  answers,
  total,
  final = false,
}: {
  answers: SubmittedAnswer[]
  total: number
  final?: boolean
}) {
  const scored = answers.filter(
    (answer) => (answer.evaluation?.score.points ?? 0) > 0,
  )
  const pending = answers.filter((answer) => answer.status === 'pending').length
  return (
    <aside className="scoreboard">
      <div className="scoreboard-heading">
        <span>{final ? 'FINAL SCORE' : 'YOUR SCORE'}</span>
        <Trophy size={17} />
      </div>
      <div className="total-score" aria-live="polite">
        <strong>{total}</strong>
        <span>points</span>
      </div>
      <div className="scoreboard-subtitle">
        <span>
          {scored.length} scoring answer{scored.length === 1 ? '' : 's'}
        </span>
        {pending > 0 && <span>{pending} judging</span>}
      </div>
      <div className="scoreboard-answers">
        {scored.length === 0 ? (
          <div className="scoreboard-empty">
            <Sparkles size={27} strokeWidth={1} />
            <p>
              {final
                ? 'A fresh category is a fresh start.'
                : 'Your bright ideas\nwill land here.'}
            </p>
          </div>
        ) : (
          [...scored].reverse().map((answer) => (
            <div className="score-row" key={answer.id}>
              <span>
                {answer.text}
                <small
                  className={answer.evaluation!.score.label!.toLowerCase()}
                >
                  {answer.evaluation!.score.label}
                </small>
              </span>
              <b>+{answer.evaluation!.score.points}</b>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
