import { Check, CircleHelp, LoaderCircle, X } from 'lucide-react'
import type { SubmittedAnswer } from '../../types/index.ts'

export function AnswerFeedback({ answer }: { answer: SubmittedAnswer }) {
  const score = answer.evaluation?.score
  const label =
    answer.status === 'pending'
      ? 'Judging…'
      : answer.status === 'duplicate'
        ? 'Already entered'
        : answer.status === 'error'
          ? 'Couldn’t judge'
          : score?.reason === 'invalid'
            ? 'Not a match'
            : score?.reason === 'low-confidence'
              ? 'Too uncertain'
              : score?.label
  const tone = score?.label?.toLowerCase() ?? 'neutral'
  return (
    <div className={`answer-feedback ${tone}`}>
      <span className="feedback-icon">
        {answer.status === 'pending' ? (
          <LoaderCircle size={18} className="animate-spin" />
        ) : answer.status === 'error' || answer.status === 'duplicate' ? (
          <CircleHelp size={18} />
        ) : score?.points ? (
          <Check size={18} />
        ) : (
          <X size={18} />
        )}
      </span>
      <div className="feedback-answer">
        <strong>{answer.text}</strong>
        <small>
          {answer.status === 'duplicate'
            ? 'That answer has already scored · no points'
            : answer.status === 'error'
              ? 'Request failed. Keep going!'
              : score?.reason === 'low-confidence'
                ? `Category match at or below ${answer.evaluation?.scoring.confidenceThreshold}% · no points`
                : score?.reason === 'invalid'
                  ? 'Outside this category · no points'
                  : answer.status === 'pending'
                    ? 'Keep the ideas coming.'
                    : 'Added to your score'}
        </small>
      </div>
      <div className="feedback-points">
        <strong>{label}</strong>
        <small>
          {answer.status === 'pending'
            ? 'one moment'
            : `+${score?.points ?? 0} points`}
        </small>
      </div>
    </div>
  )
}
