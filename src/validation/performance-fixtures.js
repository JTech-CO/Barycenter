import { runtimeStateToBodies, createRuntimeState } from '../core/state.js';
import { GRAVITATIONAL_CONSTANT } from '../core/units.js';
import { createCamera } from '../render/camera.js';
import {
  TrailRingBuffer,
  estimateDiagnosticsStorageBytes,
  estimateTrailStorageBytes,
  resolveTrailCapacity,
} from '../runtime/ring-buffer.js';

/**
 * @param {number} bodyCount
 * @param {number} [seed]
 */
export function createPerformanceState(bodyCount, seed = 0x5eed1234) {
  if (!Number.isInteger(bodyCount) || bodyCount < 2) {
    throw new Error('Performance fixture requires at least two bodies.');
  }
  let current = seed >>> 0;
  const random = () => {
    current = (Math.imul(1_664_525, current) + 1_013_904_223) >>> 0;
    return current / 4_294_967_296;
  };
  const bodies = Array.from({ length: bodyCount }, (_, index) => {
    const radius = Math.cbrt(random()) * 10 + 0.05;
    const cosine = random() * 2 - 1;
    const sine = Math.sqrt(Math.max(0, 1 - cosine * cosine));
    const angle = random() * Math.PI * 2;
    const x = radius * sine * Math.cos(angle);
    const y = radius * sine * Math.sin(angle);
    const z = radius * cosine;
    const speed = 0.002 + random() * 0.003;
    return {
      id: index + 1,
      name: 'Benchmark ' + (index + 1),
      kind: /** @type {'massive'} */ ('massive'),
      mass: 1 / bodyCount,
      position: [x, y, z],
      velocity: [-y * speed, x * speed, (random() - 0.5) * speed],
      radius: 0.45,
      fixed: false,
    };
  });
  return createRuntimeState(bodies);
}

/**
 * @param {import('../core/state.js').RuntimeState} state
 * @param {number} [requestedCapacity]
 */
export function createFilledPerformanceTrails(state, requestedCapacity = 768) {
  const capacity = resolveTrailCapacity(requestedCapacity, state.count);
  const trails = new TrailRingBuffer(state.ids, capacity);
  for (let sample = 0; sample < capacity; sample += 1) {
    trails.append(state);
    for (let index = 0; index < state.positions.length; index += 1) {
      state.positions[index] += state.velocities[index] * 1e-5;
    }
  }
  return trails;
}

/**
 * @param {import('../core/state.js').RuntimeState} state
 * @param {TrailRingBuffer} trails
 * @returns {ReturnType<import('../runtime/simulation-runtime.js').SimulationRuntime['getSnapshot']>}
 */
export function createPerformanceSnapshot(state, trails) {
  const diagnosticsCapacity = 768;
  return {
    revision: 1,
    scenarioId: 'performance-' + state.count,
    title: 'Performance fixture N=' + state.count,
    status: 'paused',
    time: 0,
    step: 0,
    fps: 60,
    bodies: runtimeStateToBodies(state),
    config: {
      integrator: 'leapfrog',
      dt: 1e-6,
      substeps: 1,
      softening: 1e-3,
      G: GRAVITATIONAL_CONSTANT,
      timeScale: 1,
      rendering: {
        trailLength: 768,
        showVelocity: false,
        showContours: false,
        showRotatingFrame: false,
      },
    },
    frame: { type: 'inertial', refA: null, refB: null },
    diagnostics: {
      energy: 0,
      energySignedError: 0,
      energyError: 0,
      angularMomentumError: 0,
      centerOfMassDrift: 0,
      constrained: false,
    },
    diagnosticsSeries: {
      time: new Float64Array(),
      energySignedError: new Float64Array(),
      energyError: new Float64Array(),
      angularMomentumError: new Float64Array(),
      centerOfMassDrift: new Float64Array(),
      separation: new Float64Array(),
    },
    trails: trails.snapshot(),
    lastError: null,
    accumulator: 0,
    limits: {
      trails: {
        requestedPerBody: 768,
        effectivePerBody: trails.capacity,
        totalPointCapacity: state.count * trails.capacity,
        storageBytes: estimateTrailStorageBytes(state.count, trails.capacity),
      },
      diagnostics: {
        capacity: diagnosticsCapacity,
        storageBytes: estimateDiagnosticsStorageBytes(diagnosticsCapacity),
      },
    },
  };
}

export function createCountingCanvasContext() {
  const counters = {
    arcs: 0,
    begins: 0,
    fills: 0,
    lines: 0,
    strokes: 0,
    texts: 0,
  };
  const context = /** @type {CanvasRenderingContext2D} */ (
    /** @type {unknown} */ ({
      arc: () => {
        counters.arcs += 1;
      },
      beginPath: () => {
        counters.begins += 1;
      },
      fill: () => {
        counters.fills += 1;
      },
      fillRect: () => {},
      fillText: () => {
        counters.texts += 1;
      },
      lineTo: () => {
        counters.lines += 1;
      },
      moveTo: () => {},
      restore: () => {},
      save: () => {},
      setLineDash: () => {},
      setTransform: () => {},
      stroke: () => {
        counters.strokes += 1;
      },
    })
  );
  return { context, counters };
}

export function createPerformanceCamera() {
  const camera = createCamera();
  camera.scale = 32;
  return camera;
}

export const PERFORMANCE_RENDER_OPTIONS = Object.freeze({
  width: 1_440,
  height: 900,
  selectedId: null,
  showVelocity: false,
  colors: {
    canvas: '#ffffff',
    grid: '#e5e7eb',
    axis: '#9ca3af',
    text: '#374151',
    accent: '#2563eb',
    selected: '#f59e0b',
    contour: '#7c3aed',
    series: ['#2563eb', '#0f766e', '#b45309', '#be123c', '#6d28d9'],
  },
});
