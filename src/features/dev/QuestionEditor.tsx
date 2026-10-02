import { OBSCURITY_CHOICES } from '../../types/index.ts'
import type { QuestionDefinition } from '../../types/index.ts'
import { textInputProps } from '../../components/common/inputProps.ts'

export function QuestionEditor({
  question,
  onChange,
  disabled,
}: {
  question: QuestionDefinition
  onChange: (question: QuestionDefinition) => void
  disabled: boolean
}) {
  const update = (patch: Partial<QuestionDefinition>) =>
    onChange({ ...question, ...patch })
  return (
    <fieldset disabled={disabled} className="question-editor">
      <label className="field-label" htmlFor="displayed-question">
        Displayed question
      </label>
      <input
        {...textInputProps}
        id="displayed-question"
        value={question.displayed_question}
        maxLength={160}
        onChange={(event) => update({ displayed_question: event.target.value })}
        placeholder="Name something unexpected"
      />
      <label className="field-label" htmlFor="instructions">
        Jev instructions
      </label>
      <textarea
        {...textInputProps}
        id="instructions"
        rows={5}
        value={question.instructions}
        maxLength={6000}
        onChange={(event) => update({ instructions: event.target.value })}
        placeholder="Define category membership and how to classify the candidate."
      />
      <p className="field-hint">
        General category rules go here. The server appends its candidate-safety
        instruction and selected regional perspective to every request.
      </p>
      {OBSCURITY_CHOICES.map((choice) => (
        <div key={choice} className="mt-6">
          <label className="field-label" htmlFor={`criteria-${choice}`}>
            {choice[0].toUpperCase() + choice.slice(1)} criteria
          </label>
          <textarea
            {...textInputProps}
            id={`criteria-${choice}`}
            rows={4}
            maxLength={3000}
            value={question.criteria[choice]}
            onChange={(event) =>
              update({
                criteria: {
                  ...question.criteria,
                  [choice]: event.target.value,
                },
              })
            }
          />
        </div>
      ))}
      <p className="field-hint mt-3">
        All four criteria are required. Use Not for exclusions; define
        familiarity in general terms so the region can supply the audience.
      </p>
    </fieldset>
  )
}
