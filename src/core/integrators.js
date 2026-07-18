import { ValidationError } from './errors.js';
import { computeAccelerations } from './forces.js';
import { cloneRuntimeState } from './state.js';

/** @typedef {import('./state.js').RuntimeState} RuntimeState */

export const INTEGRATORS = Object.freeze({
  LEAPFROG: 'leapfrog',
  YOSHIDA4: 'yoshida4',
  RK4: 'rk4',
});

const YOSHIDA_CUBERT_TWO = Math.cbrt(2);
const YOSHIDA_W1 = 1 / (2 - YOSHIDA_CUBERT_TWO);
const YOSHIDA_W0 = -YOSHIDA_CUBERT_TWO / (2 - YOSHIDA_CUBERT_TWO);

/** @param {number} dt @param {number} softening @param {number} gravitationalConstant */
function assertStepConfig(dt, softening, gravitationalConstant) {
  if (!Number.isFinite(dt) || dt === 0) {
    throw new ValidationError('Integrator dt must be finite and nonzero.');
  }
  if (!Number.isFinite(softening) || softening < 0) {
    throw new ValidationError('Integrator softening must be non-negative.');
  }
  if (!Number.isFinite(gravitationalConstant) || gravitationalConstant <= 0) {
    throw new ValidationError('Integrator G must be positive.');
  }
}

/**
 * @param {RuntimeState} state
 * @param {number} dt
 * @param {number} softening
 * @param {number} gravitationalConstant
 */
export function leapfrogStep(state, dt, softening, gravitationalConstant) {
  assertStepConfig(dt, softening, gravitationalConstant);
  const acceleration = computeAccelerations(
    state,
    softening,
    gravitationalConstant,
  );
  const halfDt = dt * 0.5;

  for (let body = 0; body < state.count; body += 1) {
    if (state.fixed[body] === 1) continue;
    const offset = body * 3;
    for (let axis = 0; axis < 3; axis += 1) {
      state.velocities[offset + axis] +=
        halfDt * acceleration[offset + axis];
      state.positions[offset + axis] += dt * state.velocities[offset + axis];
    }
  }

  computeAccelerations(
    state,
    softening,
    gravitationalConstant,
    acceleration,
  );
  for (let body = 0; body < state.count; body += 1) {
    if (state.fixed[body] === 1) continue;
    const offset = body * 3;
    for (let axis = 0; axis < 3; axis += 1) {
      state.velocities[offset + axis] +=
        halfDt * acceleration[offset + axis];
    }
  }
}

/**
 * @param {RuntimeState} state
 * @param {number} dt
 * @param {number} softening
 * @param {number} gravitationalConstant
 */
export function yoshida4Step(state, dt, softening, gravitationalConstant) {
  assertStepConfig(dt, softening, gravitationalConstant);
  leapfrogStep(
    state,
    dt * YOSHIDA_W1,
    softening,
    gravitationalConstant,
  );
  leapfrogStep(
    state,
    dt * YOSHIDA_W0,
    softening,
    gravitationalConstant,
  );
  leapfrogStep(
    state,
    dt * YOSHIDA_W1,
    softening,
    gravitationalConstant,
  );
}

/** @param {RuntimeState} base @param {Float64Array} positions @param {Float64Array} velocities */
function createStage(base, positions, velocities) {
  const stage = cloneRuntimeState(base);
  stage.positions = positions;
  stage.velocities = velocities;
  return stage;
}

/**
 * @param {RuntimeState} state
 * @param {number} dt
 * @param {number} softening
 * @param {number} gravitationalConstant
 */
export function rk4Step(state, dt, softening, gravitationalConstant) {
  assertStepConfig(dt, softening, gravitationalConstant);
  const p0 = state.positions.slice();
  const v0 = state.velocities.slice();
  const a1 = computeAccelerations(
    state,
    softening,
    gravitationalConstant,
  );
  const p2 = p0.slice();
  const v2 = v0.slice();
  const halfDt = dt * 0.5;

  for (let body = 0; body < state.count; body += 1) {
    if (state.fixed[body] === 1) continue;
    const offset = body * 3;
    for (let axis = 0; axis < 3; axis += 1) {
      const index = offset + axis;
      p2[index] = p0[index] + halfDt * v0[index];
      v2[index] = v0[index] + halfDt * a1[index];
    }
  }
  const stage2 = createStage(state, p2, v2);
  const a2 = computeAccelerations(
    stage2,
    softening,
    gravitationalConstant,
  );
  const p3 = p0.slice();
  const v3 = v0.slice();

  for (let body = 0; body < state.count; body += 1) {
    if (state.fixed[body] === 1) continue;
    const offset = body * 3;
    for (let axis = 0; axis < 3; axis += 1) {
      const index = offset + axis;
      p3[index] = p0[index] + halfDt * v2[index];
      v3[index] = v0[index] + halfDt * a2[index];
    }
  }
  const stage3 = createStage(state, p3, v3);
  const a3 = computeAccelerations(
    stage3,
    softening,
    gravitationalConstant,
  );
  const p4 = p0.slice();
  const v4 = v0.slice();

  for (let body = 0; body < state.count; body += 1) {
    if (state.fixed[body] === 1) continue;
    const offset = body * 3;
    for (let axis = 0; axis < 3; axis += 1) {
      const index = offset + axis;
      p4[index] = p0[index] + dt * v3[index];
      v4[index] = v0[index] + dt * a3[index];
    }
  }
  const stage4 = createStage(state, p4, v4);
  const a4 = computeAccelerations(
    stage4,
    softening,
    gravitationalConstant,
  );

  for (let body = 0; body < state.count; body += 1) {
    if (state.fixed[body] === 1) continue;
    const offset = body * 3;
    for (let axis = 0; axis < 3; axis += 1) {
      const index = offset + axis;
      state.positions[index] =
        p0[index] + (dt / 6) * (v0[index] + 2 * v2[index] + 2 * v3[index] + v4[index]);
      state.velocities[index] =
        v0[index] + (dt / 6) * (a1[index] + 2 * a2[index] + 2 * a3[index] + a4[index]);
    }
  }
}

/**
 * @param {RuntimeState} state
 * @param {'leapfrog' | 'yoshida4' | 'rk4'} integrator
 * @param {number} dt
 * @param {number} softening
 * @param {number} gravitationalConstant
 */
export function integrateStep(
  state,
  integrator,
  dt,
  softening,
  gravitationalConstant,
) {
  switch (integrator) {
    case INTEGRATORS.LEAPFROG:
      leapfrogStep(state, dt, softening, gravitationalConstant);
      break;
    case INTEGRATORS.YOSHIDA4:
      yoshida4Step(state, dt, softening, gravitationalConstant);
      break;
    case INTEGRATORS.RK4:
      rk4Step(state, dt, softening, gravitationalConstant);
      break;
    default:
      throw new ValidationError(`Unknown integrator: ${integrator}`);
  }
}
