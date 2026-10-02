import {
  ArrowRight,
  Fingerprint,
  Link2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import type { PublicConfig } from '../../types/index.ts'
import type { KeySession } from './useCredentials.ts'
import { Logo } from '../../components/common/Logo.tsx'
import { Button } from '../../components/common/Button.tsx'
import { storage } from '../../services/storage.ts'
import { formatTime } from '../../services/timing.ts'
import { textInputProps } from '../../components/common/inputProps.ts'

export function KeysPage({
  config,
  session,
  name,
  onNameChange,
  onPlay,
}: {
  config: PublicConfig
  session: KeySession
  name: string
  onNameChange: (name: string) => void
  onPlay: () => void
}) {
  return (
    <main className="page keys-page">
      <div className="page-intro">
        <span className="eyebrow">
          <span className="tiny-line" /> A GAME FOR THE CURIOUS
        </span>
        <h1>
          <Logo large />
        </h1>
        <p className="intro-description">
          Big categories. Unexpected answers.{' '}
          <span className="text-bright">
            {formatTime(config.roundSeconds)} of possibility.
          </span>
        </p>
      </div>
      <div className="setup-layout">
        <section className="setup-main">
          <div className="section-heading">
            <span className="step-number">01</span>
            <div>
              <h2>Make the connection</h2>
              <p>Connect your OpenRouter account to unlock the game.</p>
            </div>
            <Link2 size={22} className="heading-icon" />
          </div>
          <div className="provider-card is-selected">
            <div className="flex items-start justify-between gap-3">
              <div className="provider-choice">
                <span>
                  <strong>OpenRouter</strong>
                  <small>Authorize JevRillion with your account.</small>
                </span>
              </div>
              <span
                className={`connection-state ${session.status}`}
                aria-live="polite"
              >
                {session.status === 'connected'
                  ? 'Connected'
                  : session.status === 'connecting'
                    ? 'Connecting…'
                    : session.status === 'invalid'
                      ? 'Connection rejected'
                      : session.status === 'unavailable'
                        ? 'Provider unavailable'
                        : 'Not connected'}
              </span>
            </div>
            <label htmlFor="jev-model" className="field-label">
              Jev Model
            </label>
            <select
              id="jev-model"
              value={session.model}
              onChange={(event) => session.selectModel(event.target.value)}
              disabled={session.status === 'connecting'}
            >
              {session.models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} · {model.id}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted mt-2" role="status">
              {session.modelStatus === 'loading'
                ? 'Loading available Jev models…'
                : session.modelStatus === 'unavailable'
                  ? 'Model list unavailable. Your configured default is ready to use.'
                  : 'Choose the Jev version for this session.'}
            </p>
            <Button
              className="mt-6"
              onClick={() => void session.connect()}
              disabled={session.status === 'connecting'}
            >
              {session.connected
                ? 'Reconnect OpenRouter'
                : 'Connect OpenRouter'}{' '}
              <ArrowRight size={17} />
            </Button>
            {session.connected && (
              <button
                type="button"
                className="text-button text-xs ml-4"
                onClick={session.disconnect}
              >
                Disconnect
              </button>
            )}
            {session.message && (
              <p className="field-error" role="status">
                {session.message}
              </p>
            )}
          </div>
          <p className="privacy-note">
            <ShieldCheck size={15} />
            <span>
              OpenRouter creates a credential for your account. JevRillion keeps
              it in memory only; refreshing requires reconnecting.
            </span>
          </p>
        </section>
        <aside className="setup-aside">
          <section className="identity-card">
            <div className="section-heading">
              <span className="step-number">02</span>
              <div>
                <h2>Make a name</h2>
                <p>A little personality for the scoreboard.</p>
              </div>
            </div>
            <label htmlFor="player-name" className="field-label">
              Player name
            </label>
            <input
              {...textInputProps}
              id="player-name"
              maxLength={32}
              placeholder="Curious human"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
            />
            <p className="identity-id">
              <Fingerprint size={14} /> Player{' '}
              {storage.player().uuid.slice(0, 8)}
            </p>
            <div className="identity-divider" />
            <div className="ready-note">
              <Sparkles size={20} />
              <p>
                The obvious answer is only
                <br />
                <strong>the beginning.</strong>
              </p>
            </div>
            <Button
              className="w-full mt-6"
              disabled={!session.connected}
              onClick={onPlay}
            >
              Let’s play <ArrowRight size={17} />
            </Button>
            <p className="text-center text-xs text-muted mt-3">
              {session.connected
                ? 'Connected. Your next discovery awaits.'
                : 'Connect OpenRouter to continue.'}
            </p>
          </section>
          <div className="setup-tip">
            <span>THE TWIST</span>
            <p>More obscure answers earn more points. Dig a little deeper.</p>
            <div className="tip-points">
              <b>{config.scoring.points.common}</b>
              <span>→</span>
              <b>{config.scoring.points.uncommon}</b>
              <span>→</span>
              <b className="text-lime">
                {config.scoring.points.obscure}
                <span> pts</span>
              </b>
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}
