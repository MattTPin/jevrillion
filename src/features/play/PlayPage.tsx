import {
  ArrowRight,
  Clock3,
  CornerDownLeft,
  Layers3,
  RotateCcw,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useRef, useState } from 'react'
import type { PublicConfig, QuestionDefinition } from '../../types/index.ts'
import { Logo } from '../../components/common/Logo.tsx'
import { Button } from '../../components/common/Button.tsx'
import { Notice } from '../../components/common/Notice.tsx'
import { storage } from '../../services/storage.ts'
import { availableQuestions } from './game.ts'
import { formatTime } from '../../services/timing.ts'
import { textInputProps } from '../../components/common/inputProps.ts'
import type { useGame } from './useGame.ts'
import { AnswerFeedback } from './AnswerFeedback.tsx'
import { Scoreboard } from './Scoreboard.tsx'
import { ScoreGuide } from './ScoreGuide.tsx'
import { RoundResults } from './RoundResults.tsx'
import './play.css'

export function PlayPage({
  game,
  questions,
  config,
}: {
  game: ReturnType<typeof useGame>
  questions: QuestionDefinition[]
  config: PublicConfig
}) {
  const input = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [, refresh] = useState(0)
  const { round } = game
  const remaining = availableQuestions(
    questions,
    storage.player().history,
  ).length
  if (round.phase === 'finished')
    return (
      <main className="page play-page">
        <RoundResults
          round={round}
          attempt={game.attempt}
          saveStatus={game.saveStatus}
          onRetry={() => void game.retrySave()}
          onAgain={() => {
            setMessage('')
            game.reset()
          }}
        />
      </main>
    )

  return (
    <main
      className={`page play-page ${round.phase === 'idle' ? 'play-lobby' : ''}`}
    >
      <div className="play-atmosphere" aria-hidden="true">
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <div className="orbit orbit-three" />
        <div className="ambient-glow" />
      </div>
      {round.phase === 'idle' ? (
        <>
          <section className="play-hero">
            <span className="eyebrow">
              <span className="status-dot" /> YOUR BRAIN. A LITTLE LESS
              ORDINARY.
            </span>
            <h1>
              <Logo large />
            </h1>
            <h2>
              Think beyond
              <br />
              the <span>obvious.</span>
            </h2>
            <p>
              One category. {formatTime(config.roundSeconds)} on the clock. As
              many answers as you can find.
              <br className="desktop-break" /> The more obscure your answer, the
              more points you earn.
            </p>
            <div className="hero-action">
              {remaining > 0 ? (
                <Button
                  className="start-button"
                  onClick={() => {
                    setMessage('')
                    game.start()
                  }}
                >
                  Start <ArrowRight size={19} />
                </Button>
              ) : (
                <>
                  <div className="pool-finished">
                    <Sparkles size={20} />
                    <strong>
                      {questions.length
                        ? 'Every category, explored.'
                        : 'The question bank is empty.'}
                    </strong>
                    <p>
                      {questions.length
                        ? 'Reset the pool for another go. Your scores are here to stay.'
                        : 'Create a question in Dev mode to get started.'}
                    </p>
                  </div>
                  {questions.length > 0 && (
                    <Button
                      onClick={() => {
                        storage.resetPool()
                        refresh((value) => value + 1)
                      }}
                    >
                      <RotateCcw size={17} /> Reset question pool
                    </Button>
                  )}
                </>
              )}
              <span className="hero-meta">
                <Clock3 size={13} /> {formatTime(config.roundSeconds)} per round{' '}
              </span>
            </div>
          </section>
          <ScoreGuide points={config.scoring.points} />
          <div className="how-to">
            <div>
              <span>01</span>
              <p>
                <strong>Meet your category</strong>A new prompt, picked at
                random.
              </p>
            </div>
            <div>
              <span>02</span>
              <p>
                <strong>Follow your curiosity</strong>Keep it to four words per
                answer.
              </p>
            </div>
            <div>
              <span>03</span>
              <p>
                <strong>Find the hidden gems</strong>Go beyond the first thing
                you think of.
              </p>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="round-topline">
            <Logo />
            <span className="eyebrow">
              <Zap size={14} />{' '}
              {round.phase === 'settling'
                ? 'THE LAST IDEAS ARE LANDING'
                : 'MAKE EVERY SECOND COUNT'}
            </span>
          </div>
          <div className="round-layout">
            <section className="round-main">
              <div className="question-top">
                <span className="eyebrow">YOUR CATEGORY</span>
                <div
                  className={`timer ${round.remaining <= 10 ? 'timer-urgent' : ''}`}
                  role="timer"
                  aria-label={`${round.remaining} seconds remaining`}
                >
                  <Clock3 size={19} />
                  <strong>{formatTime(round.remaining)}</strong>
                </div>
              </div>
              <div className="timer-track">
                <div
                  style={{
                    width: `${(round.remaining / round.duration) * 100}%`,
                  }}
                />
              </div>
              <h1 className="question-title">
                {round.question?.displayed_question}
                <span>.</span>
              </h1>
              <p className="text-muted mb-8">
                {round.phase === 'settling'
                  ? 'Time’s up! Finishing the answers you already sent.'
                  : 'Trust your first thought. Then find your next one.'}
              </p>
              <form
                autoComplete="off"
                className="answer-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  const value = input.current?.value ?? ''
                  const error = game.submit(value)
                  setMessage(error ?? '')
                  if (!error && input.current) input.current.value = ''
                  input.current?.focus()
                }}
              >
                <label htmlFor="answer" className="sr-only">
                  Your answer
                </label>
                <input
                  id="answer"
                  ref={input}
                  autoFocus
                  {...textInputProps}
                  maxLength={150}
                  placeholder="A brilliant answer goes here…"
                  disabled={round.phase !== 'playing'}
                />
                <Button type="submit" disabled={round.phase !== 'playing'}>
                  Submit <ArrowRight size={17} />
                </Button>
              </form>
              <div className="input-help">
                <span>4 words max · no repeats</span>
                <span>
                  <CornerDownLeft size={12} /> Enter to submit
                </span>
              </div>
              {message && <Notice>{message}</Notice>}
              <div
                className="feedback-stream"
                aria-live="polite"
                aria-relevant="additions text"
              >
                {[...round.answers]
                  .reverse()
                  .slice(0, 6)
                  .map((answer) => (
                    <AnswerFeedback key={answer.id} answer={answer} />
                  ))}
                {round.answers.length === 0 && (
                  <div className="first-answer-hint">
                    <Sparkles size={22} />
                    <span>Your first idea starts something.</span>
                  </div>
                )}
              </div>
              <ScoreGuide points={config.scoring.points} />
            </section>
            <Scoreboard answers={round.answers} total={round.total} />
          </div>
        </>
      )}
    </main>
  )
}
