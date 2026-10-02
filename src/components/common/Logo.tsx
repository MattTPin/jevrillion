import { Sparkles } from 'lucide-react'

export function Logo({ large = false }: { large?: boolean }) {
  return (
    <span
      className={`logo ${large ? 'logo-large' : ''}`}
      aria-label="JevRillion"
    >
      <Sparkles className="logo-spark" aria-hidden="true" strokeWidth={1.7} />
      <span>
        Jev<span className="logo-accent">Rillion</span>
        <span className="logo-dot">.</span>
      </span>
    </span>
  )
}
