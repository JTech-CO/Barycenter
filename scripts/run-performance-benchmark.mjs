import { mkdirSync, writeFileSync } from 'node:fs';
import {
  arch,
  cpus,
  platform,
  release,
  totalmem,
} from 'node:os';
import { performance } from 'node:perf_hooks';
import { computeConservedQuantities } from '../src/core/diagnostics.js';
import { computeAccelerations } from '../src/core/forces.js';
import { leapfrogStep } from '../src/core/integrators.js';
import { runtimeStateToBodies } from '../src/core/state.js';
import { GRAVITATIONAL_CONSTANT } from '../src/core/units.js';
import { createWorld, stepWorld } from '../src/core/world.js';
import { drawOrbitScene } from '../src/render/graphics.js';
import { MAX_TOTAL_TRAIL_POINTS } from '../src/runtime/ring-buffer.js';
import {
  PERFORMANCE_RENDER_OPTIONS,
  createCountingCanvasContext,
  createFilledPerformanceTrails,
  createPerformanceCamera,
  createPerformanceSnapshot,
  createPerformanceState,
} from '../src/validation/performance-fixtures.js';

const BODY_COUNTS = [100, 500, 2_000];
const FRAME_BUDGET_MS = 1_000 / 60;
const SOFTENING = 1e-3;
const DT = 1e-7;

/** @param {number} value */
function rounded(value) {
  return Number(value.toFixed(6));
}

/** @param {number[]} values @param {number} quantile */
function percentile(values, quantile) {
  const index = Math.min(
    values.length - 1,
    Math.max(0, Math.ceil(values.length * quantile) - 1),
  );
  return values[index];
}

/**
 * @param {() => unknown} operation
 * @param {number} samples
 * @param {number} [warmups]
 */
function measure(operation, samples, warmups = 2) {
  for (let index = 0; index < warmups; index += 1) operation();
  const values = [];
  for (let index = 0; index < samples; index += 1) {
    const start = performance.now();
    operation();
    values.push(performance.now() - start);
  }
  values.sort((left, right) => left - right);
  return {
    samples,
    minMs: rounded(values[0]),
    p50Ms: rounded(percentile(values, 0.5)),
    p95Ms: rounded(percentile(values, 0.95)),
    maxMs: rounded(values[values.length - 1]),
  };
}

/** @param {number} bodyCount */
function sampleCount(bodyCount) {
  if (bodyCount <= 100) return 24;
  if (bodyCount <= 500) return 12;
  return 5;
}

/** @param {number} bodyCount */
function runBodyCount(bodyCount) {
  const state = createPerformanceState(bodyCount);
  const samples = sampleCount(bodyCount);
  const accelerations = new Float64Array(bodyCount * 3);
  const force = measure(
    () =>
      computeAccelerations(
        state,
        SOFTENING,
        GRAVITATIONAL_CONSTANT,
        accelerations,
      ),
    samples,
  );
  const physics = measure(
    () =>
      leapfrogStep(
        state,
        DT,
        SOFTENING,
        GRAVITATIONAL_CONSTANT,
      ),
    samples,
  );
  const diagnostics = measure(
    () =>
      computeConservedQuantities(
        state,
        SOFTENING,
        GRAVITATIONAL_CONSTANT,
      ),
    samples,
  );
  const bodySnapshot = measure(
    () => runtimeStateToBodies(state),
    samples,
  );

  const trails = createFilledPerformanceTrails(state);
  const trailAppend = measure(() => trails.append(state), samples);
  const trailSnapshot = measure(() => trails.snapshot(), samples);
  const snapshot = createPerformanceSnapshot(state, trails);
  const { context, counters } = createCountingCanvasContext();
  const camera = createPerformanceCamera();
  const render = measure(
    () =>
      drawOrbitScene(
        context,
        snapshot,
        camera,
        PERFORMANCE_RENDER_OPTIONS,
      ),
    samples,
  );

  const world = createWorld(runtimeStateToBodies(state), {
    integrator: 'leapfrog',
    dt: DT,
    substeps: 1,
    softening: SOFTENING,
    G: GRAVITATIONAL_CONSTANT,
  });
  const runtimeStep = measure(() => {
    const result = stepWorld(world);
    if (!result.ok) throw new Error(result.error.message);
  }, samples);

  const estimatedFrameP95Ms = rounded(
    runtimeStep.p95Ms +
      bodySnapshot.p95Ms +
      trailAppend.p95Ms +
      trailSnapshot.p95Ms +
      render.p95Ms,
  );
  const stateStorageBytes =
    state.ids.byteLength +
    state.kinds.byteLength +
    state.masses.byteLength +
    state.positions.byteLength +
    state.velocities.byteLength +
    state.radii.byteLength +
    state.fixed.byteLength;
  return {
    bodyCount,
    fixture: {
      distribution: 'seeded uniform 3D sphere',
      seed: '0x5eed1234',
      totalMassSolar: 1,
      radiusAu: 10,
      softeningAu: SOFTENING,
      dtYr: DT,
    },
    timings: {
      forceOracle: force,
      physicsLeapfrog: physics,
      diagnostics,
      bodySnapshot,
      trailAppend,
      trailSnapshot,
      renderAdapter: render,
      runtimeStep,
      estimatedFrameP95Ms,
      estimatedFps: rounded(1_000 / estimatedFrameP95Ms),
      meets60FpsGoal: estimatedFrameP95Ms <= FRAME_BUDGET_MS,
      longTask: estimatedFrameP95Ms >= 50,
    },
    history: {
      requestedTrailPerBody: 768,
      effectiveTrailPerBody: trails.capacity,
      totalTrailPointCapacity: bodyCount * trails.capacity,
      stateStorageBytes,
      trailStorageBytes: snapshot.limits.trails.storageBytes,
      trailSnapshotBytes:
        snapshot.limits.trails.totalPointCapacity *
        3 *
        Float64Array.BYTES_PER_ELEMENT,
      diagnosticsStorageBytes: snapshot.limits.diagnostics.storageBytes,
    },
    renderDispatch: {
      lineSegmentsPerSample: Math.round(counters.lines / (samples + 2)),
      strokesPerSample: Math.round(counters.strokes / (samples + 2)),
    },
  };
}

function environmentRecord() {
  const cpu = cpus()[0];
  return {
    node: process.version,
    platform: platform() + ' ' + release() + ' ' + arch(),
    cpu: cpu?.model ?? 'unknown',
    logicalCpuCount: cpus().length,
    totalMemoryGiB: rounded(totalmem() / 1024 ** 3),
    device:
      process.env.BARYCENTER_BENCH_DEVICE ??
      'unspecified local reference device',
    browser:
      process.env.BARYCENTER_BENCH_BROWSER ??
      'Node Canvas-dispatch adapter; physical browser not measured',
    powerMode:
      process.env.BARYCENTER_BENCH_POWER ?? 'unspecified',
    viewport:
      process.env.BARYCENTER_BENCH_VIEWPORT ?? '1440x900 @ 1x',
  };
}

/** @param {ReturnType<typeof runBodyCount>[]} results */
function decisionRecord(results) {
  const hundreds = results.find((entry) => entry.bodyCount === 500);
  const thousands = results.find((entry) => entry.bodyCount === 2_000);
  if (!hundreds || !thousands) throw new Error('Missing benchmark body counts.');
  return {
    directOracleRetained: true,
    barnesHutIntroduced: false,
    workerIntroduced: false,
    coreV1Target: 'hundreds of bodies at a 60 fps frame budget',
    targetResult:
      'N=500 estimated p95 frame ' +
      hundreds.timings.estimatedFrameP95Ms +
      ' ms (' +
      hundreds.timings.estimatedFps +
      ' fps)',
    highDensityResult:
      'N=2000 estimated p95 frame ' +
      thousands.timings.estimatedFrameP95Ms +
      ' ms (' +
      thousands.timings.estimatedFps +
      ' fps)',
    rationale:
      hundreds.timings.meets60FpsGoal
        ? 'Direct CPU summation meets the Core v1 hundreds-body target on the reference device. Barnes-Hut parity risk is deferred; N=2000 is documented as non-realtime and is the trigger for a future 3D octree path.'
        : 'Direct CPU summation misses the Core v1 hundreds-body target; acceleration work is required before release.',
  };
}

/** @param {ReturnType<typeof runBodyCount>[]} results */
function assertions(results) {
  const failures = [];
  for (const entry of results) {
    if (entry.history.totalTrailPointCapacity > MAX_TOTAL_TRAIL_POINTS) {
      failures.push(
        'N=' + entry.bodyCount + ' exceeded the total trail point budget.',
      );
    }
  }
  const hundreds = results.find((entry) => entry.bodyCount === 500);
  if (!hundreds?.timings.meets60FpsGoal) {
    failures.push('N=500 missed the 16.67 ms estimated frame budget.');
  }
  return failures;
}

/** @param {ReturnType<typeof runBodyCount>[]} results @param {ReturnType<typeof environmentRecord>} environment @param {ReturnType<typeof decisionRecord>} decision */
function markdown(results, environment, decision, generatedAt) {
  const lines = [
    '# M7 performance baseline',
    '',
    '**Generated**: ' + generatedAt,
    '**Runtime**: ' + environment.node,
    '**Platform**: ' + environment.platform,
    '**Device**: ' + environment.device,
    '**CPU**: ' + environment.cpu + ' (' + environment.logicalCpuCount + ' logical)',
    '**Memory**: ' + environment.totalMemoryGiB + ' GiB',
    '**Browser reference**: ' + environment.browser,
    '**Power mode**: ' + environment.powerMode,
    '**Viewport**: ' + environment.viewport,
    '',
    '## Separated p95 costs',
    '',
    '| N | force oracle | leapfrog | diagnostics | full runtime step | body snapshot | trail append | trail snapshot | render adapter | frame estimate | estimated fps | long task |',
    '|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|:---:|',
  ];
  for (const entry of results) {
    const timing = entry.timings;
    lines.push(
      '| ' +
        entry.bodyCount +
        ' | ' +
        timing.forceOracle.p95Ms +
        ' ms | ' +
        timing.physicsLeapfrog.p95Ms +
        ' ms | ' +
        timing.diagnostics.p95Ms +
        ' ms | ' +
        timing.runtimeStep.p95Ms +
        ' ms | ' +
        timing.bodySnapshot.p95Ms +
        ' ms | ' +
        timing.trailAppend.p95Ms +
        ' ms | ' +
        timing.trailSnapshot.p95Ms +
        ' ms | ' +
        timing.renderAdapter.p95Ms +
        ' ms | ' +
        timing.estimatedFrameP95Ms +
        ' ms | ' +
        timing.estimatedFps +
        ' | ' +
        (timing.longTask ? 'yes' : 'no') +
        ' |',
    );
  }
  lines.push(
    '',
    'The frame estimate sums independently sampled p95 JavaScript costs. The render adapter measures projection and Canvas command dispatch with a counting context; it excludes browser rasterization, compositor scheduling, and paint.',
    '',
    '## Bounded history',
    '',
    '| N | effective trail/body | total trail points | trail storage | trail snapshot | diagnostics storage |',
    '|---:|---:|---:|---:|---:|---:|',
  );
  for (const entry of results) {
    const history = entry.history;
    lines.push(
      '| ' +
        entry.bodyCount +
        ' | ' +
        history.effectiveTrailPerBody +
        ' | ' +
        history.totalTrailPointCapacity +
        ' | ' +
        history.trailStorageBytes +
        ' B | ' +
        history.trailSnapshotBytes +
        ' B | ' +
        history.diagnosticsStorageBytes +
        ' B |',
    );
  }
  lines.push(
    '',
    '## Acceleration decision',
    '',
    '- Direct oracle retained: ' + decision.directOracleRetained,
    '- Barnes-Hut introduced: ' + decision.barnesHutIntroduced,
    '- Worker introduced: ' + decision.workerIntroduced,
    '- Target: ' + decision.targetResult,
    '- High density: ' + decision.highDensityResult,
    '- Rationale: ' + decision.rationale,
    '',
    '## Reproduction',
    '',
    '- pnpm benchmark',
    '- pnpm report:performance',
    '',
    'Performance results are machine-specific. The deterministic fixture, body order, units, softening, fixed step, sample counts, and trail budget are versioned; compare regressions on the same device and power mode.',
    '',
  );
  return lines.join('\n');
}

const results = BODY_COUNTS.map(runBodyCount);
const environment = environmentRecord();
const decision = decisionRecord(results);
const failures = assertions(results);
const generatedAt = new Date().toISOString();
const payload = {
  schemaVersion: 1,
  generatedAt,
  command: 'pnpm benchmark',
  frameBudgetMs: rounded(FRAME_BUDGET_MS),
  environment,
  results,
  accelerationDecision: decision,
  assertions: {
    passed: failures.length === 0,
    failures,
  },
};
const report = markdown(results, environment, decision, generatedAt);

if (process.argv.includes('--write')) {
  mkdirSync(new URL('../reports/', import.meta.url), { recursive: true });
  writeFileSync(
    new URL('../reports/performance-baseline.json', import.meta.url),
    JSON.stringify(payload, null, 2) + '\n',
  );
  writeFileSync(
    new URL('../reports/performance-baseline.md', import.meta.url),
    report,
  );
}

process.stdout.write(report);
if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
}
if (process.argv.includes('--assert') && failures.length > 0) {
  process.stderr.write(
    'Performance assertions failed:\n' +
      failures.map((failure) => '- ' + failure).join('\n') +
      '\n',
  );
  process.exitCode = 1;
}
