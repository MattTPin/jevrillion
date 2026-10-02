import { OBSCURITY_CHOICES } from '../../types/index.ts'
import type { Evaluation } from '../../types/index.ts'

export function EvaluationDetails({ evaluation }: { evaluation: Evaluation }) {
  return (
    <div className="test-result">
      <div
        className={`test-score ${evaluation.score.label?.toLowerCase() ?? ''}`}
      >
        <strong>
          {evaluation.score.label ??
            (evaluation.score.reason === 'invalid'
              ? 'Not a match'
              : 'Too uncertain')}
        </strong>
        <span>+{evaluation.score.points} points</span>
      </div>
      <dl>
        {OBSCURITY_CHOICES.map((choice) => (
          <div key={choice}>
            <dt>{choice} probability</dt>
            <dd>
              {Number(evaluation.decision.probabilities[choice].toFixed(2))}%
            </dd>
          </div>
        ))}
        <div>
          <dt>Jev choice / awarded choice</dt>
          <dd>
            {evaluation.decision.choice} / {evaluation.score.choice}
          </dd>
        </div>
        <div>
          <dt>Overall confidence (diagnostic)</dt>
          <dd>{Number(evaluation.decision.confidence.toFixed(2))}%</dd>
        </div>
        <div>
          <dt>Required probability</dt>
          <dd>&gt; {evaluation.scoring.confidenceThreshold}%</dd>
        </div>
        <div>
          <dt>Region</dt>
          <dd>{evaluation.region}</dd>
        </div>
        {evaluation.acceptedAnswer && (
          <div>
            <dt>Scored spelling</dt>
            <dd>{evaluation.acceptedAnswer}</dd>
          </div>
        )}
      </dl>
      <details open>
        <summary>Jev decision data</summary>
        <pre>{JSON.stringify(evaluation.decision.raw, null, 2)}</pre>
      </details>
    </div>
  )
}
