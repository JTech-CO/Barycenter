import styles from '../workbench/Workbench.module.css';

const WIDTH = 228;
const HEIGHT = 104;
const PADDING = 10;

/** @param {ArrayLike<number>} values */
function pathFor(values) {
  if (values.length === 0) return '';
  const stride = Math.max(1, Math.ceil(values.length / 240));
  const sampled = [];
  for (let index = 0; index < values.length; index += stride) {
    sampled.push(values[index]);
  }
  if ((values.length - 1) % stride !== 0) sampled.push(values[values.length - 1]);
  const minimum = Math.min(...sampled);
  const maximum = Math.max(...sampled);
  const span = Math.max(maximum - minimum, Math.abs(maximum) * 1e-12, 1e-16);
  return sampled
    .map((value, index) => {
      const x =
        PADDING +
        ((WIDTH - PADDING * 2) * index) / Math.max(1, sampled.length - 1);
      const y =
        HEIGHT -
        PADDING -
        ((HEIGHT - PADDING * 2) * (value - minimum)) / span;
      return (index === 0 ? 'M' : 'L') + ' ' + x.toFixed(2) + ' ' + y.toFixed(2);
    })
    .join(' ');
}

/**
 * @param {{label: string, values: ArrayLike<number>, valueLabel: string}} props
 */
export function MiniPlot({ label, values, valueLabel }) {
  const path = pathFor(values);
  return (
    <figure className={styles.miniPlot}>
      <figcaption>
        <span>{label}</span>
        <strong>{valueLabel}</strong>
      </figcaption>
      <svg
        viewBox={'0 0 ' + WIDTH + ' ' + HEIGHT}
        preserveAspectRatio="none"
        role="img"
        aria-label={label + ' history, ' + values.length + ' samples'}
      >
        <line
          className={styles.plotAxis}
          x1={PADDING}
          y1={HEIGHT - PADDING}
          x2={WIDTH - PADDING}
          y2={HEIGHT - PADDING}
        />
        {path ? <path className={styles.plotLine} d={path} /> : null}
      </svg>
      {values.length < 2 ? (
        <span className={styles.plotEmpty}>Step the simulation to collect samples.</span>
      ) : null}
    </figure>
  );
}
