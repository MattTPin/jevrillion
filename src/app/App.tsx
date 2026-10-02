import { useEffect, useState } from 'react'
import { ArrowUpRight, LoaderCircle } from 'lucide-react'
import type { PublicConfig, QuestionDefinition } from '../types/index.ts'
import { api, errorMessage } from '../services/api.ts'
import { storage, storageWarning } from '../services/storage.ts'
import { syncHistory } from '../services/history.ts'
import { Button } from '../components/common/Button.tsx'
import { Logo } from '../components/common/Logo.tsx'
import { Navigation } from '../components/common/Navigation.tsx'
import type { Tab } from '../components/common/Navigation.tsx'
import { Notice } from '../components/common/Notice.tsx'
import { useCredentials } from '../features/keys/useCredentials.ts'
import type { OAuthCallback } from '../features/keys/oauth.ts'
import { KeysPage } from '../features/keys/KeysPage.tsx'
import { PlayPage } from '../features/play/PlayPage.tsx'
import { useGame } from '../features/play/useGame.ts'
import { LeaderboardPage } from '../features/leaderboard/LeaderboardPage.tsx'
import { DevPage } from '../features/dev/DevPage.tsx'

function GameApp({
  config,
  initialQuestions,
  oauthCallback,
}: {
  config: PublicConfig
  initialQuestions: QuestionDefinition[]
  oauthCallback: OAuthCallback | null
}) {
  const [tab, setTab] = useState<Tab>('keys')
  const [questions, setQuestions] = useState(initialQuestions)
  const [name, setName] = useState(() => storage.player().name)
  const session = useCredentials(oauthCallback, config.model, tab === 'keys')
  const game = useGame(questions, session.credentials, config)
  const goPlay = () => {
    if (session.connected) setTab('play')
  }
  useEffect(() => {
    void syncHistory().catch(() => {
      /* Pending scores stay queued for retry. */
    })
  }, [])
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Navigation
        tab={tab}
        onChange={setTab}
        connected={session.connected}
        devMode={config.devMode}
        active={game.active}
      />
      <div id="main-content" tabIndex={-1}>
        {storageWarning() && (
          <div className="storage-notice">
            <Notice>{storageWarning()}</Notice>
          </div>
        )}
        {tab === 'keys' && (
          <KeysPage
            config={config}
            session={session}
            name={name}
            onNameChange={(value) => {
              setName(value)
              storage.setName(value)
            }}
            onPlay={goPlay}
          />
        )}
        {tab === 'play' && session.connected && (
          <PlayPage game={game} questions={questions} config={config} />
        )}
        {tab === 'leaderboard' && (
          <LeaderboardPage onPlay={goPlay} connected={session.connected} />
        )}
        {tab === 'dev' && config.devMode && (
          <DevPage
            questions={questions}
            onQuestionsChange={setQuestions}
            config={config}
            credentials={session.credentials}
            connected={session.connected}
          />
        )}
      </div>
      <footer className="site-footer">
        <span>A little knowledge. A lot of possibility.</span>
        <span>
          Judged by{' '}
          <a href="https://typesafe.ai" target="_blank" rel="noreferrer">
            Jev <ArrowUpRight size={12} />
          </a>
          <span className="footer-dot">·</span> Made for curious minds
        </span>
      </footer>
    </>
  )
}

export default function App({
  oauthCallback,
}: {
  oauthCallback: OAuthCallback | null
}) {
  const [data, setData] = useState<{
    config: PublicConfig
    questions: QuestionDefinition[]
  } | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let cancelled = false
    void Promise.all([api.config(), api.questions()]).then(
      ([config, questions]) => {
        if (!cancelled) setData({ config, questions })
      },
      (reason) => {
        if (!cancelled) setError(errorMessage(reason))
      },
    )
    return () => {
      cancelled = true
    }
  }, [retry])
  if (!data)
    return (
      <div className="boot-screen">
        <Logo large />
        {error ? (
          <>
            <Notice>{error}</Notice>
            <Button
              onClick={() => {
                setError('')
                setRetry(retry + 1)
              }}
            >
              Try again
            </Button>
          </>
        ) : (
          <p>
            <LoaderCircle size={18} className="animate-spin" /> Warming up your
            next bright idea…
          </p>
        )}
      </div>
    )
  return (
    <GameApp
      config={data.config}
      initialQuestions={data.questions}
      oauthCallback={oauthCallback}
    />
  )
}
