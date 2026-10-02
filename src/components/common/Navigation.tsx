import { Code2, Link2, LockKeyhole, Play, Trophy } from 'lucide-react'
import { Logo } from './Logo.tsx'

export type Tab = 'keys' | 'play' | 'leaderboard' | 'dev'

export function Navigation({
  tab,
  onChange,
  connected,
  devMode,
  active,
}: {
  tab: Tab
  onChange: (tab: Tab) => void
  connected: boolean
  devMode: boolean
  active: boolean
}) {
  const items = [
    { id: 'keys' as const, label: 'Connect', icon: Link2 },
    { id: 'play' as const, label: 'Play', icon: Play },
    { id: 'leaderboard' as const, label: 'Leaderboard', icon: Trophy },
    ...(devMode ? [{ id: 'dev' as const, label: 'Dev', icon: Code2 }] : []),
  ]
  return (
    <header className="site-header">
      <div className="header-inner">
        <Logo />
        <nav className="navigation" aria-label="Main navigation">
          {items.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`nav-link ${tab === id ? 'is-active' : ''}`}
              aria-current={tab === id ? 'page' : undefined}
              disabled={
                (id === 'play' && !connected) || (active && id !== 'play')
              }
              title={
                id === 'play' && !connected
                  ? 'Connect OpenRouter first'
                  : active && id !== 'play'
                    ? 'Finish this round first'
                    : undefined
              }
              onClick={() => onChange(id)}
            >
              {id === 'play' && !connected ? (
                <LockKeyhole size={15} />
              ) : (
                <Icon size={16} />
              )}
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <span className="local-status">
          <span className="status-dot" /> Local play
        </span>
      </div>
    </header>
  )
}
