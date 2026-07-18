import { INTEGRATORS } from '../core/integrators.js';
import { GRAVITATIONAL_CONSTANT } from '../core/units.js';
import {
  createCircularBinaryFixture,
  createEccentricBinaryFixture,
  createFigureEightFixture,
  createPlanetaryMassRatioFixture,
  createReferenceFixtures,
  createLowMomentumSymmetryFixture,
  createSoftenedCloseEncounterFixture,
} from '../scenarios/reference.js';
import {
  analyzeBinaryOrbit,
  compareIntegratorEnergy,
  runConservationExperiment,
  runConvergenceStudy,
} from './physics.js';

/** @param {number} value */
function formatMetric(value) {
  if (value === 0) return '0';
  if (Math.abs(value) >= 1e-3 && Math.abs(value) < 1e4) {
    return value.toPrecision(7);
  }
  return value.toExponential(6);
}

/**
 * Build the deterministic M3 evidence object. It intentionally carries no
 * wall-clock timestamp so repeated runs can be diffed directly.
 *
 * @param {string} [runtime]
 */
export function buildPhysicsReport(runtime = 'unspecified') {
  const circularFixture = createCircularBinaryFixture();
  const eccentricFixture = createEccentricBinaryFixture();
  const massRatioFixture = createPlanetaryMassRatioFixture();
  const figureEightFixture = createFigureEightFixture();
  const circular = analyzeBinaryOrbit(circularFixture, {
    stepsPerPeriod: 512,
  });
  const eccentric = analyzeBinaryOrbit(eccentricFixture, {
    stepsPerPeriod: 2048,
  });
  const massRatio = analyzeBinaryOrbit(massRatioFixture, {
    stepsPerPeriod: 1024,
  });
  const leapfrogConvergence = runConvergenceStudy(
    circularFixture,
    INTEGRATORS.LEAPFROG,
    [32, 64, 128],
  );
  const yoshidaConvergence = runConvergenceStudy(
    circularFixture,
    INTEGRATORS.YOSHIDA4,
    [16, 32, 64],
  );
  const binaryLong = runConservationExperiment(circularFixture, {
    periods: 1000,
    stepsPerPeriod: 64,
    sampleEvery: 8,
    integrator: INTEGRATORS.LEAPFROG,
  });
  const figureEightLong = runConservationExperiment(figureEightFixture, {
    periods: 100,
    stepsPerPeriod: 1024,
    sampleEvery: 64,
    integrator: INTEGRATORS.YOSHIDA4,
  });
  const lowMomentumSafety = runConservationExperiment(
    createLowMomentumSymmetryFixture(),
    { duration: 0.05, sampleEvery: 10 },
  );
  const closeEncounterSafety = runConservationExperiment(
    createSoftenedCloseEncounterFixture(),
    { duration: 1e-5, sampleEvery: 5 },
  );
  const comparison = compareIntegratorEnergy(circularFixture, {
    periods: 100,
    stepsPerPeriod: 32,
  });
  const gates = [
    {
      id: 'circular-period',
      metric: 'Circular period relative error',
      value: circular.periodRelativeError,
      operator: '≤',
      limit: circularFixture.tolerances.periodRelative,
      pass:
        circular.periodRelativeError <=
        circularFixture.tolerances.periodRelative,
    },
    {
      id: 'eccentric-period',
      metric: 'Eccentric period relative error',
      value: eccentric.periodRelativeError,
      operator: '≤',
      limit: eccentricFixture.tolerances.periodRelative,
      pass:
        eccentric.periodRelativeError <=
        eccentricFixture.tolerances.periodRelative,
    },
    {
      id: 'mass-ratio-period',
      metric: 'Mass-ratio period relative error',
      value: massRatio.periodRelativeError,
      operator: '≤',
      limit: massRatioFixture.tolerances.periodRelative,
      pass:
        massRatio.periodRelativeError <=
        massRatioFixture.tolerances.periodRelative,
    },
    {
      id: 'binary-energy-trend',
      metric: '1,000-period trend / energy envelope',
      value: binaryLong.trendToEnvelope,
      operator: '≤',
      limit: 0.1,
      pass: binaryLong.trendToEnvelope <= 0.1,
    },
    {
      id: 'binary-angular-momentum',
      metric: 'Binary maximum angular-momentum error',
      value: binaryLong.maximumAngularMomentumError,
      operator: '≤',
      limit: circularFixture.tolerances.angularMomentum,
      pass:
        binaryLong.maximumAngularMomentumError <=
        circularFixture.tolerances.angularMomentum,
    },
    {
      id: 'binary-center-of-mass',
      metric: 'Binary maximum expected-COM error',
      value: binaryLong.maximumCenterOfMassDrift,
      operator: '≤',
      limit: circularFixture.tolerances.centerOfMass,
      pass:
        binaryLong.maximumCenterOfMassDrift <=
        circularFixture.tolerances.centerOfMass,
    },
    {
      id: 'figure-eight-recurrence',
      metric: '100-period figure-8 recurrence error',
      value: figureEightLong.recurrenceError,
      operator: '≤',
      limit: figureEightFixture.tolerances.recurrence,
      pass:
        figureEightLong.recurrenceError <=
        figureEightFixture.tolerances.recurrence,
    },
    {
      id: 'figure-eight-separation',
      metric: 'Figure-8 minimum sampled separation',
      value: figureEightLong.minimumSeparation,
      operator: '≥',
      limit: figureEightFixture.tolerances.minimumSeparation,
      pass:
        figureEightLong.minimumSeparation >=
        figureEightFixture.tolerances.minimumSeparation,
    },
    {
      id: 'figure-eight-radius',
      metric: 'Figure-8 maximum origin radius',
      value: figureEightLong.maximumRadius,
      operator: '≤',
      limit: figureEightFixture.tolerances.maximumRadius,
      pass:
        figureEightLong.maximumRadius <=
        figureEightFixture.tolerances.maximumRadius,
    },
    {
      id: 'figure-eight-energy',
      metric: 'Figure-8 maximum absolute energy error',
      value: figureEightLong.maximumAbsoluteEnergyError,
      operator: '≤',
      limit: figureEightFixture.tolerances.energy,
      pass:
        figureEightLong.maximumAbsoluteEnergyError <=
        figureEightFixture.tolerances.energy,
    },
    {
      id: 'figure-eight-angular-momentum',
      metric: 'Figure-8 scale-normalized angular error',
      value: figureEightLong.maximumAngularMomentumError,
      operator: '≤',
      limit: figureEightFixture.tolerances.angularMomentum,
      pass:
        figureEightLong.maximumAngularMomentumError <=
        figureEightFixture.tolerances.angularMomentum,
    },
    {
      id: 'figure-eight-center-of-mass',
      metric: 'Figure-8 expected-COM error',
      value: figureEightLong.maximumCenterOfMassDrift,
      operator: '≤',
      limit: figureEightFixture.tolerances.centerOfMass,
      pass:
        figureEightLong.maximumCenterOfMassDrift <=
        figureEightFixture.tolerances.centerOfMass,
    },
  ];

  return {
    schemaVersion: 1,
    milestone: 'M3',
    releaseMarker: 'Core Alpha',
    runtime,
    normalizedUnits: { distance: 'AU', time: 'yr', mass: 'M☉' },
    gravitationalConstant: GRAVITATIONAL_CONSTANT,
    commands: {
      fast: 'pnpm test:physics',
      long: 'pnpm test:physics:long',
      report: 'pnpm report:physics',
    },
    fixtures: createReferenceFixtures().map((fixture) => ({
      id: fixture.id,
      label: fixture.label,
      category: fixture.category,
      source: fixture.source,
      sourceUrl: fixture.sourceUrl,
      unitConversion: fixture.unitConversion,
      bodyCount: fixture.bodies.length,
      referencePeriod: fixture.referencePeriod,
      config: fixture.config,
      expected: fixture.expected,
      tolerances: fixture.tolerances,
    })),
    analytic: { circular, eccentric, massRatio },
    convergence: {
      leapfrog: leapfrogConvergence,
      yoshida4: yoshidaConvergence,
    },
    conservation: {
      binary1000Periods: binaryLong,
      figureEight100Periods: figureEightLong,
      lowMomentumSafety,
      closeEncounterSafety,
    },
    comparison: {
      note:
        'RK4 is report-only. No CI assertion requires monotonic drift at a selected dt.',
      ...comparison,
    },
    gates,
    allPassed: gates.every((gate) => gate.pass),
  };
}

/** @param {ReturnType<typeof buildPhysicsReport>} report */
export function physicsReportToMarkdown(report) {
  const lines = [
    '# Barycenter M3 physics baseline',
    '',
    `- Release marker: **${report.releaseMarker}**`,
    `- Runtime: \`${report.runtime}\``,
    `- Units: AU · yr · M☉; \`G = ${report.gravitationalConstant}\``,
    `- Overall gate: **${report.allPassed ? 'PASS' : 'FAIL'}**`,
    '',
    '## Reproduce',
    '',
    `- Fast regression: \`${report.commands.fast}\``,
    `- Long horizon: \`${report.commands.long}\``,
    `- Regenerate this report: \`${report.commands.report}\``,
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
    '## Convergence',
    '',
    `- Leapfrog observed orders: ${report.convergence.leapfrog.observedOrders.map(formatMetric).join(', ')}`,
    `- Yoshida4 observed orders: ${report.convergence.yoshida4.observedOrders.map(formatMetric).join(', ')}`,
    '',
    '## Integrator comparison (report only)',
    '',
    '| Integrator | Peak-to-peak energy error | Trend/envelope | Final recurrence |',
    '|---|---:|---:|---:|',
    `| Leapfrog | ${formatMetric(report.comparison.leapfrog.energyPeakToPeak)} | ${formatMetric(report.comparison.leapfrog.trendToEnvelope)} | ${formatMetric(report.comparison.leapfrog.recurrenceError)} |`,
    `| RK4 | ${formatMetric(report.comparison.rk4.energyPeakToPeak)} | ${formatMetric(report.comparison.rk4.trendToEnvelope)} | ${formatMetric(report.comparison.rk4.recurrenceError)} |`,
    '',
    report.comparison.note,
    '',
    '## Fixture provenance',
    '',
    '| Fixture | Source | Unit conversion |',
    '|---|---|---|',
    ...report.fixtures.map(
      (fixture) =>
        `| ${fixture.label} | [${fixture.source}](${fixture.sourceUrl}) | ${fixture.unitConversion} |`,
    ),
    '',
  ];
  return lines.join('\n');
}
