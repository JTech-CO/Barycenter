import { NumericalError, ValidationError } from './errors.js';
import { BODY_KIND } from './state.js';
import { GRAVITATIONAL_CONSTANT } from './units.js';

/** @typedef {import('./state.js').RuntimeState} RuntimeState */

/** @param {number} softening @param {number} gravitationalConstant */
function assertForceConfig(softening, gravitationalConstant) {
  if (!Number.isFinite(softening) || softening < 0) {
    throw new ValidationError('Softening must be finite and non-negative.');
  }
  if (!Number.isFinite(gravitationalConstant) || gravitationalConstant <= 0) {
    throw new ValidationError(
      'Gravitational constant must be finite and positive.',
    );
  }
}

/**
 * Direct O(N²) acceleration oracle. Massive pairs are evaluated symmetrically;
 * tracers receive acceleration but never act as gravity sources.
 *
 * @param {RuntimeState} state
 * @param {number} [softening]
 * @param {number} [gravitationalConstant]
 * @param {Float64Array} [out]
 * @returns {Float64Array}
 */
export function computeAccelerations(
  state,
  softening = 0,
  gravitationalConstant = GRAVITATIONAL_CONSTANT,
  out = new Float64Array(state.count * 3),
) {
  assertForceConfig(softening, gravitationalConstant);
  if (out.length !== state.count * 3) {
    throw new ValidationError('Acceleration output has an invalid length.');
  }
  out.fill(0);
  const epsilonSquared = softening * softening;

  for (let left = 0; left < state.count - 1; left += 1) {
    const leftOffset = left * 3;
    const leftMassive = state.kinds[left] === BODY_KIND.MASSIVE;
    for (let right = left + 1; right < state.count; right += 1) {
      const rightOffset = right * 3;
      const rightMassive = state.kinds[right] === BODY_KIND.MASSIVE;
      if (!leftMassive && !rightMassive) continue;

      const dx = state.positions[rightOffset] - state.positions[leftOffset];
      const dy =
        state.positions[rightOffset + 1] - state.positions[leftOffset + 1];
      const dz =
        state.positions[rightOffset + 2] - state.positions[leftOffset + 2];
      const softenedDistanceSquared =
        dx * dx + dy * dy + dz * dz + epsilonSquared;
      if (!(softenedDistanceSquared > 0)) {
        throw new NumericalError(
          `Coincident bodies ${state.ids[left]} and ${state.ids[right]} require softening.`,
        );
      }
      const kernel =
        gravitationalConstant /
        (softenedDistanceSquared * Math.sqrt(softenedDistanceSquared));

      if (rightMassive) {
        const factor = state.masses[right] * kernel;
        out[leftOffset] += factor * dx;
        out[leftOffset + 1] += factor * dy;
        out[leftOffset + 2] += factor * dz;
      }
      if (leftMassive) {
        const factor = state.masses[left] * kernel;
        out[rightOffset] -= factor * dx;
        out[rightOffset + 1] -= factor * dy;
        out[rightOffset + 2] -= factor * dz;
      }
    }
  }

  return out;
}

/**
 * Softened potential energy paired with computeAccelerations.
 * Tracers carry zero mass and therefore do not contribute.
 *
 * @param {RuntimeState} state
 * @param {number} [softening]
 * @param {number} [gravitationalConstant]
 */
export function computePotentialEnergy(
  state,
  softening = 0,
  gravitationalConstant = GRAVITATIONAL_CONSTANT,
) {
  assertForceConfig(softening, gravitationalConstant);
  const epsilonSquared = softening * softening;
  let potential = 0;

  for (let left = 0; left < state.count - 1; left += 1) {
    if (state.kinds[left] !== BODY_KIND.MASSIVE) continue;
    const leftOffset = left * 3;
    for (let right = left + 1; right < state.count; right += 1) {
      if (state.kinds[right] !== BODY_KIND.MASSIVE) continue;
      const rightOffset = right * 3;
      const dx = state.positions[rightOffset] - state.positions[leftOffset];
      const dy =
        state.positions[rightOffset + 1] - state.positions[leftOffset + 1];
      const dz =
        state.positions[rightOffset + 2] - state.positions[leftOffset + 2];
      const softenedDistance = Math.sqrt(
        dx * dx + dy * dy + dz * dz + epsilonSquared,
      );
      if (!(softenedDistance > 0)) {
        throw new NumericalError(
          `Coincident massive bodies ${state.ids[left]} and ${state.ids[right]} require softening.`,
        );
      }
      potential -=
        (gravitationalConstant * state.masses[left] * state.masses[right]) /
        softenedDistance;
    }
  }

  return potential;
}
