import { OBSCURITY_CHOICES } from '../../types/index.ts'
import type { Evaluation } from '../../types/index.ts'
import { LABELS } from '../../services/scoring.ts'

export function EvaluationDetails({ evaluation }: { evaluation: Evaluation }) {
  const stepUp = evaluation.score.stepUp
  const categoryProbability = OBSCURITY_CHOICES
    .filter((choice) => choice !== 'not')
    .reduce((total, choice) => total + evaluation.decision.probabilities[choice], 0)
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
      {stepUp && (
        <p className="field-hint mt-3" role="status">
          Step-up threshold rule triggered: {LABELS[stepUp.from]} →{' '}
          {evaluation.score.label}. Probability gap{' '}
          {Number(stepUp.probabilityGap.toFixed(2))} percentage points is within
          the configured {evaluation.scoring.bonusStepUpMargin}-point margin.
        </p>
      )}
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
          <dt>Required category probability</dt>
          <dd>&gt; {evaluation.scoring.confidenceThreshold}%</dd>
        </div>
        <div>
          <dt>Combined scoring probability</dt>
          <dd>{Number(categoryProbability.toFixed(2))}%</dd>
        </div>
        <div>
          <dt>Bonus step-up margin</dt>
          <dd>{evaluation.scoring.bonusStepUpMargin} percentage points</dd>
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
