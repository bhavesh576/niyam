import { useMemo, useState } from 'react'
import { DigitalWeighingTestPanel } from '../components/DigitalWeighingTestPanel'
import { InstrumentConfigurationForm } from '../components/InstrumentConfigurationForm'
import { TestResolutionPanel } from '../components/TestResolutionPanel'
import { TestResultPanel } from '../components/TestResultPanel'
import { ValidationResultPanel } from '../components/ValidationResultPanel'
import {
  createExampleObservationDraft,
  createExampleTestConditionDraft,
  createOfficialExampleDraft,
} from '../data/defaultConfiguration'
import type { InstrumentDraft } from '../domain/models/draft'
import type { TestConditionDraft } from '../domain/models/testCondition'
import type { TestObservationDraft } from '../domain/models/observation'
import { toInstrumentConfig } from '../domain/models/draft'
import { toTestObservationInput } from '../domain/models/observation'
import { normalizeConfiguration } from '../domain/normalizeConfiguration'
import { validateConfiguration } from '../domain/validation/validateConfiguration'
import { evaluateDigitalWeighingObservation } from '../domain/evaluation/evaluateObservation'
import type { PerformedEvaluation, TestObservationInput } from '../domain/evaluation/types'

/**
 * The three work areas of the application: the instrument, the test performed on it, and the result
 * of that test with its report.
 */
export type WorkArea = 'configuration' | 'digital-test' | 'result-report'

/**
 * The screen of this build: the instrument configuration, the digital weighing test performed on
 * it, and the result of that test with the report generated from it.
 *
 * State kept here is deliberately minimal: the two drafts (text + display units), whether a
 * validation run has been requested, and which work area is shown. The configuration in grams, the
 * validation result and the normalized range model are all derived, so they can never disagree with
 * what is on screen.
 *
 * The three areas share one instrument and one evaluation: the test evaluates observations against
 * the same normalized range model the configuration produced, and the result area maps that same
 * evaluation into a report, so switching areas cannot put a different instrument under test or
 * report a calculation that was not performed. The configuration area keeps its Phase 1/Phase 2
 * behaviour unchanged and is the area shown first.
 */
export function ConfigurationPage() {
  const [draft, setDraft] = useState<InstrumentDraft>(() => createOfficialExampleDraft())
  const [validationRequested, setValidationRequested] = useState(false)
  // Test condition (L, I, I_next) of the resolution panel. Kept apart from the configuration draft:
  // editing the instrument must not silently change the load under examination.
  const [testDraft, setTestDraft] = useState<TestConditionDraft>(() => createExampleTestConditionDraft())
  // Observation (L, I, ΔL, I_next, E₀) of the digital weighing test. Kept apart from the
  // configuration draft and from the Phase 2 test condition for the same reason.
  const [observationDraft, setObservationDraft] = useState<TestObservationDraft>(() =>
    createExampleObservationDraft(),
  )
  const [area, setArea] = useState<WorkArea>('configuration')
  // The evaluation of the current observation, kept with the instrument and the values it was
  // produced from, so a verdict is never shown against an instrument it does not belong to.
  const [evaluation, setEvaluation] = useState<PerformedEvaluation | null>(null)

  // Draft (text, g/kg) -> domain configuration (grams). The single conversion point.
  const config = useMemo(() => toInstrumentConfig(draft), [draft])

  // Validation runs on request and then stays live while the configuration is edited.
  const result = useMemo(
    () => (validationRequested ? validateConfiguration(config) : null),
    [config, validationRequested],
  )

  // Range model is derived only from an accepted configuration.
  const instrument = useMemo(() => (result?.valid ? normalizeConfiguration(config) : null), [config, result])

  function handleValidate() {
    setValidationRequested(true)
  }

  function handleReset() {
    setDraft(createOfficialExampleDraft())
    setTestDraft(createExampleTestConditionDraft())
    handleResetObservation()
    setValidationRequested(false)
  }

  /** Editing the observation invalidates the verdict calculated from the previous values. */
  function handleObservationChange(next: TestObservationDraft) {
    setObservationDraft(next)
    setEvaluation(null)
  }

  function handleEvaluateObservation() {
    if (instrument === null) return
    const input: TestObservationInput = toTestObservationInput(observationDraft)
    setEvaluation({ instrument, input, result: evaluateDigitalWeighingObservation(instrument, input) })
  }

  function handleResetObservation() {
    setObservationDraft(createExampleObservationDraft())
    setEvaluation(null)
  }

  return (
    <>
      <nav className="view-switch" aria-label="Work areas">
        <button
          type="button"
          className={area === 'configuration' ? 'view-button is-active' : 'view-button'}
          aria-current={area === 'configuration' ? 'true' : undefined}
          onClick={() => setArea('configuration')}
        >
          Instrument configuration
        </button>
        <button
          type="button"
          className={area === 'digital-test' ? 'view-button is-active' : 'view-button'}
          aria-current={area === 'digital-test' ? 'true' : undefined}
          onClick={() => setArea('digital-test')}
        >
          Digital weighing test
        </button>
        <button
          type="button"
          className={area === 'result-report' ? 'view-button is-active' : 'view-button'}
          aria-current={area === 'result-report' ? 'true' : undefined}
          onClick={() => setArea('result-report')}
        >
          Test result and report
        </button>
      </nav>

      <div className="page-body">
        {/* Two panes: what the tester enters on the left, what NIYAM resolved from it on the right.
            Neither pane pushes the other off the screen, and each scrolls inside itself if it must. */}
        {area === 'configuration' ? (
          <div className="split split-config">
            <InstrumentConfigurationForm
              draft={draft}
              issues={result?.issues ?? []}
              instrument={instrument}
              onDraftChange={setDraft}
              onValidate={handleValidate}
              onReset={handleReset}
            />

            <div className="pane pane-aside">
              {result === null ? (
                <p className="pane-empty">Validate the configuration to see the range model.</p>
              ) : (
                <>
                  <ValidationResultPanel result={result} instrument={instrument} />
                  {/* Range / MPE resolution needs an accepted configuration: the normalized range model
                      is the input to every resolver, so the probes appear only once it is valid. */}
                  {result.valid && instrument ? (
                    <TestResolutionPanel instrument={instrument} draft={testDraft} onDraftChange={setTestDraft} />
                  ) : null}
                </>
              )}
            </div>
          </div>
        ) : area === 'digital-test' ? (
          <DigitalWeighingTestPanel
            instrument={instrument}
            draft={observationDraft}
            evaluation={evaluation}
            evaluationIsStale={evaluation !== null && evaluation.instrument !== instrument}
            onDraftChange={handleObservationChange}
            onEvaluate={handleEvaluateObservation}
            onResetObservation={handleResetObservation}
            onOpenConfiguration={() => setArea('configuration')}
          />
        ) : (
          /* The result area is given the instrument and the evaluation, and nothing else: the report
             it maps is the report of this instrument and this evaluation, or no report at all. */
          <TestResultPanel
            instrument={instrument}
            evaluation={evaluation}
            onOpenTest={() => setArea('digital-test')}
            onOpenConfiguration={() => setArea('configuration')}
          />
        )}
      </div>
    </>
  )
}
