import { CircleAlert, LoaderCircle, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import styles from '../workbench/Workbench.module.css';
import { asScenarioDraftError } from './contracts.js';
import { requestScenarioDraft } from './client.js';

/** @typedef {import('./contracts.js').ScenarioDraft} ScenarioDraft */

/**
 * @param {{
 *   onApply: (draft: ScenarioDraft, source: 'local-reference' | 'proxy') => void,
 *   onClose: () => void,
 *   onEvent: (level: 'info' | 'warning' | 'error', message: string) => void,
 * }} props
 */
export function ScenarioComposer({ onApply, onClose, onEvent }) {
  const [prompt, setPrompt] = useState('');
  const [stage, setStage] = useState(
    /** @type {'compose' | 'requesting' | 'review' | 'error'} */ ('compose'),
  );
  const [result, setResult] = useState(
    /** @type {{draft: ScenarioDraft, source: 'local-reference' | 'proxy'} | null} */ (
      null
    ),
  );
  const [errorMessage, setErrorMessage] = useState('');
  const activeRequest = useRef(0);
  const proxyEndpoint =
    typeof import.meta.env.VITE_BARYCENTER_AI_PROXY_URL === 'string'
      ? import.meta.env.VITE_BARYCENTER_AI_PROXY_URL.trim()
      : '';
  const sourceLabel =
    proxyEndpoint.length > 0
      ? 'Configured server proxy'
      : 'Built-in offline reference interpreter';

  useEffect(
    () => () => {
      activeRequest.current += 1;
    },
    [],
  );

  /** @param {import('react').FormEvent<HTMLFormElement>} event */
  const submit = async (event) => {
    event.preventDefault();
    const requestId = activeRequest.current + 1;
    activeRequest.current = requestId;
    setStage('requesting');
    setErrorMessage('');
    setResult(null);
    onEvent('info', 'Natural-language draft request started via ' + sourceLabel + '.');
    try {
      const next = await requestScenarioDraft(prompt, {
        endpoint: proxyEndpoint,
      });
      if (activeRequest.current !== requestId) return;
      setResult(next);
      setStage('review');
      onEvent(
        'info',
        'Validated draft is ready for review; the simulation is unchanged.',
      );
    } catch (error) {
      if (activeRequest.current !== requestId) return;
      const normalized = asScenarioDraftError(error);
      setErrorMessage(normalized.message);
      setStage('error');
      onEvent('error', normalized.code + ': ' + normalized.message);
    }
  };

  return (
    <div className={styles.scenarioComposerBackdrop} role="presentation">
      <section
        className={styles.scenarioComposer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="scenario-composer-title"
      >
        <header>
          <div>
            <Sparkles size={16} aria-hidden="true" />
            <div>
              <h2 id="scenario-composer-title">Natural-language scenario</h2>
              <span>Request → review → apply</span>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close natural-language scenario"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>

        <form onSubmit={submit}>
          <label>
            <span>Describe the gravitational system</span>
            <textarea
              autoFocus
              value={prompt}
              maxLength={4_096}
              disabled={stage === 'requesting'}
              placeholder="예: 태양 두 개와 그 주위를 도는 행성"
              onChange={(event) => setPrompt(event.target.value)}
            />
          </label>
          <div className={styles.scenarioComposerSource}>
            <span>Source</span>
            <strong>{sourceLabel}</strong>
            <small>No API credential is stored in this client.</small>
          </div>

          {stage === 'error' ? (
            <div className={styles.scenarioComposerError} role="alert">
              <CircleAlert size={15} aria-hidden="true" />
              <div>
                <strong>Draft was not applied</strong>
                <p>{errorMessage}</p>
              </div>
            </div>
          ) : null}

          {stage === 'review' && result ? (
            <section className={styles.scenarioComposerReview} aria-label="Scenario draft review">
              <header>
                <span>Validated candidate</span>
                <strong>{result.draft.scenario.title}</strong>
              </header>
              <dl>
                <div>
                  <dt>Bodies</dt>
                  <dd>{result.draft.scenario.bodies.length}</dd>
                </div>
                <div>
                  <dt>Integrator</dt>
                  <dd>{result.draft.scenario.config.integrator}</dd>
                </div>
                <div>
                  <dt>Fixed Δt</dt>
                  <dd>{result.draft.scenario.config.dt} yr</dd>
                </div>
                <div>
                  <dt>Units</dt>
                  <dd>AU · yr · M☉</dd>
                </div>
              </dl>
              <ul>
                {result.draft.scenario.bodies.map((body) => (
                  <li key={body.id}>
                    <span>{body.name}</span>
                    <code>
                      {body.kind} · {body.mass} M☉
                    </code>
                  </li>
                ))}
              </ul>
              <p>
                Review complete? Apply replaces the current edit point. Until
                then, playback, presets, and manual editing remain untouched.
              </p>
            </section>
          ) : null}

          <footer>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            {stage === 'review' && result ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setStage('compose');
                    setResult(null);
                  }}
                >
                  Revise
                </button>
                <button
                  type="button"
                  data-primary
                  onClick={() => onApply(result.draft, result.source)}
                >
                  Apply validated draft
                </button>
              </>
            ) : (
              <button
                type="submit"
                data-primary
                disabled={stage === 'requesting' || prompt.trim().length === 0}
              >
                {stage === 'requesting' ? (
                  <>
                    <LoaderCircle className={styles.scenarioComposerSpinner} size={14} />
                    Validating…
                  </>
                ) : (
                  'Generate draft'
                )}
              </button>
            )}
          </footer>
        </form>
      </section>
    </div>
  );
}
