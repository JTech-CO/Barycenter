import { createDiagnosticReference, measureDiagnostics } from './diagnostics.js';
import { ValidationError } from './errors.js';
import { INTEGRATORS, integrateStep } from './integrators.js';
import {
  assertFiniteState,
  cloneRuntimeState,
  copyRuntimeState,
  createRuntimeState,
  runtimeStateToBodies,
} from './state.js';
import { GRAVITATIONAL_CONSTANT } from './units.js';

/** @typedef {import('./state.js').Body} Body */
/** @typedef {import('./state.js').RuntimeState} RuntimeState */

/**
 * @typedef {object} SimConfig
 * @property {'leapfrog' | 'yoshida4' | 'rk4'} integrator
 * @property {number} dt
 * @property {number} substeps
 * @property {number} softening
 * @property {number} G
 *
 * @typedef {object} World
 * @property {RuntimeState} state
 * @property {RuntimeState} initialState
 * @property {SimConfig} config
 * @property {number} time
 * @property {number} step
 * @property {'idle' | 'running' | 'paused' | 'error'} status
 * @property {{name: string, message: string, step: number, time: number} | null} lastError
 * @property {ReturnType<typeof createDiagnosticReference>} diagnosticReference
 * @property {ReturnType<typeof measureDiagnostics>} diagnostics
 */

export const DEFAULT_SIM_CONFIG = Object.freeze({
  integrator: INTEGRATORS.LEAPFROG,
  dt: 1 / 365.25,
  substeps: 1,
  softening: 1e-6,
  G: GRAVITATIONAL_CONSTANT,
});

/** @param {Partial<SimConfig>} config @returns {SimConfig} */
export function normalizeSimConfig(config = {}) {
  const normalized = { ...DEFAULT_SIM_CONFIG, ...config };
  if (!Object.values(INTEGRATORS).includes(normalized.integrator)) {
    throw new ValidationError(`Unknown integrator: ${normalized.integrator}`);
  }
  if (!Number.isFinite(normalized.dt) || normalized.dt <= 0) {
    throw new ValidationError('World dt must be finite and positive.');
  }
  if (!Number.isInteger(normalized.substeps) || normalized.substeps <= 0) {
    throw new ValidationError('World substeps must be a positive integer.');
  }
  if (!Number.isFinite(normalized.softening) || normalized.softening < 0) {
    throw new ValidationError('World softening must be non-negative.');
  }
  if (!Number.isFinite(normalized.G) || normalized.G <= 0) {
    throw new ValidationError('World G must be finite and positive.');
  }
  return normalized;
}

/** @param {Body[]} bodies @param {Partial<SimConfig>} [config] @returns {World} */
export function createWorld(bodies, config = {}) {
  const state = createRuntimeState(bodies);
  assertFiniteState(state);
  const normalizedConfig = normalizeSimConfig(config);
  const diagnosticReference = createDiagnosticReference(
    state,
    normalizedConfig.softening,
    normalizedConfig.G,
  );
  return {
    state,
    initialState: cloneRuntimeState(state),
    config: normalizedConfig,
    time: 0,
    step: 0,
    status: 'idle',
    lastError: null,
    diagnosticReference,
    diagnostics: measureDiagnostics(
      state,
      diagnosticReference,
      0,
      normalizedConfig.softening,
      normalizedConfig.G,
    ),
  };
}

/** @param {World} world @param {number} [outerSteps] */
export function stepWorld(world, outerSteps = 1) {
  if (!Number.isInteger(outerSteps) || outerSteps <= 0) {
    throw new ValidationError('outerSteps must be a positive integer.');
  }

  for (let outer = 0; outer < outerSteps; outer += 1) {
    const before = cloneRuntimeState(world.state);
    const beforeTime = world.time;
    const beforeStep = world.step;
    try {
      const substepDt = world.config.dt / world.config.substeps;
      for (let substep = 0; substep < world.config.substeps; substep += 1) {
        integrateStep(
          world.state,
          world.config.integrator,
          substepDt,
          world.config.softening,
          world.config.G,
        );
        assertFiniteState(world.state);
      }
      world.time += world.config.dt;
      world.step += 1;
      world.lastError = null;
      if (world.status !== 'running') world.status = 'paused';
    } catch (error) {
      copyRuntimeState(world.state, before);
      world.time = beforeTime;
      world.step = beforeStep;
      world.status = 'error';
      world.lastError = {
        name: error instanceof Error ? error.name : 'Error',
        message: error instanceof Error ? error.message : String(error),
        step: beforeStep,
        time: beforeTime,
      };
      return { ok: false, error: world.lastError };
    }
  }

  world.diagnostics = measureDiagnostics(
    world.state,
    world.diagnosticReference,
    world.time,
    world.config.softening,
    world.config.G,
  );
  return { ok: true, diagnostics: world.diagnostics };
}

/** @param {World} world */
export function resetWorld(world) {
  copyRuntimeState(world.state, world.initialState);
  world.time = 0;
  world.step = 0;
  world.status = 'idle';
  world.lastError = null;
  world.diagnosticReference = createDiagnosticReference(
    world.state,
    world.config.softening,
    world.config.G,
  );
  world.diagnostics = measureDiagnostics(
    world.state,
    world.diagnosticReference,
    0,
    world.config.softening,
    world.config.G,
  );
}

/** @param {World} world @param {'idle' | 'running' | 'paused'} status */
export function setWorldStatus(world, status) {
  world.status = status;
}

/** @param {World} world */
export function snapshotWorld(world) {
  return {
    bodies: runtimeStateToBodies(world.state),
    config: { ...world.config },
    time: world.time,
    step: world.step,
    status: world.status,
    diagnostics: {
      energyError: world.diagnostics.energyError,
      angularMomentumError: world.diagnostics.angularMomentumError,
      centerOfMassDrift: world.diagnostics.centerOfMassDrift,
      constrained: world.diagnostics.constrained,
    },
  };
}
