import {
  jacobiConstant,
  sampleZeroVelocityGrid,
  solveLagrangePoints,
} from '../core/cr3bp.js';
import { createCr3bpPresets } from '../scenarios/cr3bp.js';
import { runCr3bpJacobiExperiment } from './cr3bp.js';

/** @param {number} value */
function formatMetric(value) {
  if (value === 0) return '0';
  if (Math.abs(value) >= 1e-3 && Math.abs(value) < 1e4) {
    return value.toPrecision(7);
  }
  return value.toExponential(6);
}

/** @param {string} [runtime] */
export function buildAnalysisReport(runtime = 'unspecified') {
  const presets = createCr3bpPresets();
  const mu = presets[0].normalization.mu;
  const points = solveLagrangePoints(mu);
  const pointRecords = Object.fromEntries(
    Object.entries(points).map(([label, solution]) => [
      label,
      {
        position: Array.from(solution.position),
        residual: solution.residual,
        iterations: solution.iterations,
        bracket: solution.bracket,
      },
    ]),
  );
  const l4Jacobi = jacobiConstant(mu, points.L4.position, [0, 0, 0]);
  const coarseGrid = sampleZeroVelocityGrid(mu, l4Jacobi, {
    xMin: -1.5,
    xMax: 1.5,
    yMin: -1.2,
    yMax: 1.2,
    width: 41,
    height: 33,
  });
  const fineGrid = sampleZeroVelocityGrid(mu, l4Jacobi, {
    xMin: -2,
    xMax: 2,
    yMin: -1.5,
    yMax: 1.5,
    width: 82,
    height: 66,
  });
  const experiments = presets.map((preset) => ({
    preset: {
      id: preset.id,
      label: preset.label,
      description: preset.description,
      mu: preset.normalization.mu,
      dt: preset.config.dt,
      recommendedPeriods: preset.recommendedPeriods,
      referenceJacobi: preset.referenceJacobi,
      tolerances: preset.tolerances,
    },
    result: runCr3bpJacobiExperiment(preset),
  }));
  const gates = [
    ...Object.entries(pointRecords).map(([label, point]) => ({
      id: `${label.toLowerCase()}-gradient`,
      metric: `${label} effective-potential gradient residual`,
      value: point.residual,
      operator: '≤',
      limit: 1e-11,
      pass: point.residual <= 1e-11,
    })),
    ...experiments.flatMap(({ preset, result }) => [
      {
        id: `${preset.id}-jacobi`,
        metric: `${preset.label} maximum Jacobi error`,
        value: result.maximumJacobiError,
        operator: '≤',
        limit: preset.tolerances.jacobiAbsolute,
        pass: result.maximumJacobiError <= preset.tolerances.jacobiAbsolute,
      },
      {
        id: `${preset.id}-recurrence`,
        metric: `${preset.label} recurrence/boundedness error`,
        value: result.recurrenceError,
        operator: '≤',
        limit: preset.tolerances.recurrence,
        pass: result.recurrenceError <= preset.tolerances.recurrence,
      },
    ]),
  ];
  return {
    schemaVersion: 1,
    milestone: 'M4',
    releaseMarker: 'Analysis Alpha',
    runtime,
    canonicalConvention:
      'Total mass=1, primary at (-μ,0), secondary at (1-μ,0), angular rate=1.',
    massRatio: mu,
    lagrangePoints: pointRecords,
    zeroVelocityGrids: [
      {
        width: coarseGrid.width,
        height: coarseGrid.height,
        bounds: coarseGrid.bounds,
        minimum: coarseGrid.minimum,
        maximum: coarseGrid.maximum,
        finite: coarseGrid.values.every(Number.isFinite),
      },
      {
        width: fineGrid.width,
        height: fineGrid.height,
        bounds: fineGrid.bounds,
        minimum: fineGrid.minimum,
        maximum: fineGrid.maximum,
        finite: fineGrid.values.every(Number.isFinite),
      },
    ],
    experiments,
    gates,
    allPassed:
      gates.every((gate) => gate.pass) &&
      coarseGrid.values.every(Number.isFinite) &&
      fineGrid.values.every(Number.isFinite),
  };
}

/** @param {ReturnType<typeof buildAnalysisReport>} report */
export function analysisReportToMarkdown(report) {
  const lines = [
    '# Barycenter M4 analysis baseline',
    '',
    `- Release marker: **${report.releaseMarker}**`,
    `- Runtime: \`${report.runtime}\``,
    `- Canonical convention: ${report.canonicalConvention}`,
    `- Overall gate: **${report.allPassed ? 'PASS' : 'FAIL'}**`,
    '',
    '## Fixed gates',
    '',
    '| Gate | Observed | Limit | Status |',
    '|---|---:|---:|:---:|',
    ...report.gates.map(
      (gate) =>
        `| ${gate.metric} | ${formatMetric(gate.value)} | ${gate.operator} ${formatMetric(gate.limit)} | ${gate.pass ? 'PASS' : 'FAIL'} |`,
    ),
    '',
    '## Lagrange points',
    '',
    '| Point | x | y | Residual | Iterations |',
    '|---|---:|---:|---:|---:|',
    ...Object.entries(report.lagrangePoints).map(
      ([label, point]) =>
        `| ${label} | ${formatMetric(point.position[0])} | ${formatMetric(point.position[1])} | ${formatMetric(point.residual)} | ${point.iterations} |`,
    ),
    '',
    '## Reproduce',
    '',
    '- Analysis tests: `pnpm test:analysis`',
    '- Regenerate this report: `pnpm report:analysis`',
    '',
  ];
  return lines.join('\n');
}
