import { useEffect, useId, useRef, useState } from 'react';
import styles from '../workbench/Workbench.module.css';

/** @param {number} value */
function formatDraft(value) {
  if (!Number.isFinite(value)) return '';
  if (value === 0) return '0';
  const magnitude = Math.abs(value);
  if (magnitude >= 1e5 || magnitude < 1e-4) return value.toExponential(6);
  return String(Number(value.toPrecision(10)));
}

/**
 * Scientific number input with direct entry, keyboard stepping, and pointer scrub.
 * @param {{
 *   label: string,
 *   value: number,
 *   onCommit: (value: number) => void,
 *   unit?: string,
 *   min?: number,
 *   max?: number,
 *   step?: number,
 *   disabled?: boolean,
 * }} props
 */
export function NumberField({
  label,
  value,
  onCommit,
  unit = '',
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step,
  disabled = false,
}) {
  const inputId = useId();
  const [draft, setDraft] = useState(() => formatDraft(value));
  const scrub = useRef(
    /** @type {{pointerId: number, startX: number, startValue: number, currentValue: number, step: number} | null} */ (
      null
    ),
  );

  useEffect(() => {
    if (!scrub.current) setDraft(formatDraft(value));
  }, [value]);

  const commit = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      setDraft(formatDraft(value));
      return;
    }
    const normalized = Object.is(parsed, -0) ? 0 : parsed;
    setDraft(formatDraft(normalized));
    if (normalized !== value) onCommit(normalized);
  };

  /** @param {import('react').PointerEvent<HTMLButtonElement>} event */
  const beginScrub = (event) => {
    if (disabled || event.button !== 0) return;
    const finiteSpan =
      Number.isFinite(min) && Number.isFinite(max)
        ? Math.abs(max - min) / 2000
        : 0;
    const scrubStep =
      step ?? Math.max(Math.abs(value) * 0.0025, finiteSpan, 1e-6);
    scrub.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startValue: value,
      currentValue: value,
      step: scrubStep,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  /** @param {import('react').PointerEvent<HTMLButtonElement>} event */
  const moveScrub = (event) => {
    const active = scrub.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const next = Math.min(
      max,
      Math.max(min, active.startValue + (event.clientX - active.startX) * active.step),
    );
    active.currentValue = next;
    setDraft(formatDraft(next));
  };

  /** @param {import('react').PointerEvent<HTMLButtonElement>} event */
  const finishScrub = (event) => {
    const active = scrub.current;
    if (!active || active.pointerId !== event.pointerId) return;
    scrub.current = null;
    const normalized = Object.is(active.currentValue, -0) ? 0 : active.currentValue;
    setDraft(formatDraft(normalized));
    if (normalized !== value) onCommit(normalized);
  };

  return (
    <div className={styles.numberField}>
      <button
        type="button"
        className={styles.scrubLabel}
        aria-label={'Drag to adjust ' + label}
        disabled={disabled}
        onPointerDown={beginScrub}
        onPointerMove={moveScrub}
        onPointerUp={finishScrub}
        onPointerCancel={finishScrub}
      >
        {label}
      </button>
      <div className={styles.inputShell}>
        <input
          id={inputId}
          aria-label={label}
          inputMode="decimal"
          value={draft}
          disabled={disabled}
          min={Number.isFinite(min) ? min : undefined}
          max={Number.isFinite(max) ? max : undefined}
          step={step ?? 'any'}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              setDraft(formatDraft(value));
              event.currentTarget.blur();
            }
          }}
        />
        {unit ? <span>{unit}</span> : null}
      </div>
    </div>
  );
}
