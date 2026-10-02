import { Circle, Diamond, Sparkles } from 'lucide-react'
import type { ScoringSettings } from '../../types/index.ts'

export function ScoreGuide({ points }: { points: ScoringSettings['points'] }) {
  return (
    <div className="score-guide" aria-label="Scoring guide">
      <div>
        <Circle size={14} className="common" />
        <span>Common</span>
        <b>
          {points.common} <small>pts</small>
        </b>
      </div>
      <div>
        <Diamond size={14} className="uncommon" />
        <span>Uncommon</span>
        <b>
          {points.uncommon} <small>pts</small>
        </b>
      </div>
      <div>
        <Sparkles size={16} className="obscure" />
        <span>Obscure</span>
        <b>
          {points.obscure} <small>pts</small>
        </b>
      </div>
    </div>
  )
}
