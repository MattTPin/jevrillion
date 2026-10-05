import { Code2, FlaskConical, LoaderCircle, Plus, Save } from 'lucide-react'
import { useState } from 'react'
import type {
  Credentials,
  Evaluation,
  PublicConfig,
  QuestionDefinition,
} from '../../types/index.ts'
import { api, errorMessage } from '../../services/api.ts'
import { answerError, parseQuestion } from '../../services/validation.ts'
import { Button } from '../../components/common/Button.tsx'
import { Notice } from '../../components/common/Notice.tsx'
import { textInputProps } from '../../components/common/inputProps.ts'
import { EvaluationDetails } from './EvaluationDetails.tsx'
import { QuestionEditor } from './QuestionEditor.tsx'

const emptyQuestion = (): QuestionDefinition => ({
  uuid: 'newdraft',
  displayed_question: '',
  instructions: '',
  criteria: { common: '', uncommon: '', obscure: '', not: '' },
})

export function DevPage({
  questions,
  onQuestionsChange,
  config,
  credentials,
  connected,
}: {
  questions: QuestionDefinition[]
  onQuestionsChange: (questions: QuestionDefinition[]) => void
  config: PublicConfig
  credentials: Credentials
  connected: boolean
}) {
  const [draft, setDraft] = useState<QuestionDefinition>(
    questions[0] ?? emptyQuestion(),
  )
  const [isNew, setIsNew] = useState(questions.length === 0)
  const [dirty, setDirty] = useState(false)
  const [pendingSelection, setPendingSelection] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [candidate, setCandidate] = useState('')
  const [testing, setTesting] = useState(false)
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [testError, setTestError] = useState('')

  const select = (id: string) => {
    setIsNew(id === 'new')
    setDraft(
      questions.find((question) => question.uuid === id) ?? emptyQuestion(),
    )
    setDirty(false)
    setPendingSelection(null)
    setMessage('')
    setEvaluation(null)
    setTestError('')
  }
  const requestSelection = (id: string) => {
    if (dirty) setPendingSelection(id)
    else select(id)
  }
  const save = async () => {
    setMessage('')
    let question: QuestionDefinition
    try {
      question = parseQuestion(draft)
    } catch (error) {
      setMessage(errorMessage(error))
      return
    }
    setSaving(true)
    try {
      const saved = await api.saveQuestion(question, isNew)
      onQuestionsChange(
        isNew
          ? [...questions, saved]
          : questions.map((item) => (item.uuid === saved.uuid ? saved : item)),
      )
      setDraft(saved)
      setIsNew(false)
      setDirty(false)
      setMessage('Saved to the question bank.')
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }
  const test = async () => {
    setTestError('')
    setEvaluation(null)
    try {
      const question = parseQuestion(draft)
      const error = answerError(candidate)
      if (error) throw new Error(error)
      setTesting(true)
      setEvaluation(await api.testAnswer(credentials, question, candidate))
    } catch (error) {
      setTestError(errorMessage(error))
    } finally {
      setTesting(false)
    }
  }
  return (
    <main className="page dev-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <Code2 size={15} /> THE QUESTION WORKSHOP
          </span>
          <h1>
            Refine the <span className="text-lime">gray areas.</span>
          </h1>
          <p>Tune the rules. Try an edge case. Make a better category.</p>
        </div>
        <span className="mini-tag">DEV MODE</span>
      </div>
      <div className="dev-toolbar">
        <label className="sr-only" htmlFor="question-select">
          Choose question
        </label>
        <select
          id="question-select"
          disabled={saving || testing}
          value={isNew ? 'new' : draft.uuid}
          onChange={(event) => requestSelection(event.target.value)}
        >
          {isNew && <option value="new">New question</option>}
          {questions.map((question) => (
            <option key={question.uuid} value={question.uuid}>
              {question.displayed_question}
            </option>
          ))}
        </select>
        <Button
          variant="secondary"
          disabled={saving || testing}
          onClick={() => requestSelection('new')}
        >
          <Plus size={16} /> Create question
        </Button>
      </div>
      {pendingSelection && (
        <div className="notice flex-wrap" role="status">
          <span>You have unsaved edits.</span>
          <Button variant="secondary" onClick={() => select(pendingSelection)}>
            Discard edits and switch
          </Button>
          <Button variant="ghost" onClick={() => setPendingSelection(null)}>
            Keep editing
          </Button>
        </div>
      )}
      <div className="dev-layout">
        <section className="editor-panel">
          <div className="flex items-center justify-between mb-5">
            <h2>{isNew ? 'New category' : 'Category definition'}</h2>
            {dirty && (
              <span className="text-xs text-muted">Unsaved changes</span>
            )}
          </div>
          <QuestionEditor
            question={draft}
            disabled={saving || testing}
            onChange={(question) => {
              setDraft(question)
              setDirty(true)
              setEvaluation(null)
              setMessage('')
            }}
          />
          <div className="mt-6">
            <Button onClick={() => void save()} disabled={saving || testing}>
              {saving ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {isNew ? 'Save new question' : 'Save changes'}
            </Button>
          </div>
          {message && (
            <div className="mt-4">
              <Notice>{message}</Notice>
            </div>
          )}
        </section>
        <aside className="test-panel">
          <span className="eyebrow">
            <FlaskConical size={15} /> THE TEST BENCH
          </span>
          <h2>Does it count?</h2>
          <p className="text-sm text-muted mb-6">
            Test the current draft, including unsaved edits. Test answers never
            affect your game history.
          </p>
          <form
            autoComplete="off"
            onSubmit={(event) => {
              event.preventDefault()
              if (!testing) void test()
            }}
          >
            <label htmlFor="test-answer" className="field-label">
              Candidate answer
            </label>
            <input
              {...textInputProps}
              id="test-answer"
              value={candidate}
              maxLength={150}
              placeholder="Try an answer…"
              onChange={(event) => setCandidate(event.target.value)}
            />
            <Button
              type="submit"
              className="w-full mt-3"
              disabled={!connected || testing || saving}
            >
              {testing ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <FlaskConical size={16} />
              )}{' '}
              {testing ? 'Judging…' : 'Test answer'}
            </Button>
          </form>
          {!connected && (
            <p className="field-hint mt-3">
              Connect OpenRouter on the Connect tab first.
            </p>
          )}
          {testError && (
            <div className="mt-4">
              <Notice>{testError}</Notice>
            </div>
          )}
          {evaluation && <EvaluationDetails evaluation={evaluation} />}
          <details className="mt-6">
            <summary>Always appended: {config.region.id} perspective</summary>
            <p className="field-hint mt-3">{config.region.prompt}</p>
          </details>
          <p className="field-hint mt-6">
            The combined Common, Uncommon, and Obscure probability must exceed{' '}
            {config.scoring.confidenceThreshold}%. Close calls can step up one
            tier within {config.scoring.bonusStepUpMargin} percentage points.
            Overall decision confidence is diagnostic only.
          </p>
        </aside>
      </div>
    </main>
  )
}
