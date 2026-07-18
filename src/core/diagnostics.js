import { computePotentialEnergy } from './forces.js';
import { BODY_KIND, isConstrainedState } from './state.js';
import { GRAVITATIONAL_CONSTANT } from './units.js';

/** @typedef {import('./state.js').RuntimeState} RuntimeState */

/**
 * @typedef {object} ConservedQuantities
 * @property {number} energy
 * @property {number} kineticEnergy
 * @property {number} potentialEnergy
 * @property {Float64Array} momentum
 * @property {Float64Array} angularMomentum
 * @property {Float64Array} centerOfMass
 * @property {number} totalMass
 * @property {{energy: number, angularMomentum: number, length: number}} scales
 * @property {boolean} constrained
 */

/**
 * @param {RuntimeState} state
 * @param {number} [softening]
 * @param {number} [gravitationalConstant]
 * @returns {ConservedQuantities}
 */
export function computeConservedQuantities(
  state,
  softening = 0,
  gravitationalConstant = GRAVITATIONAL_CONSTANT,
) {
  let kineticEnergy = 0;
  let totalMass = 0;
  let angularMomentumScale = 0;
  const momentum = new Float64Array(3);
  const angularMomentum = new Float64Array(3);
  const centerOfMass = new Float64Array(3);

  for (let body = 0; body < state.count; body += 1) {
    if (state.kinds[body] !== BODY_KIND.MASSIVE) continue;
    const mass = state.masses[body];
    const offset = body * 3;
    const px = state.positions[offset];
    const py = state.positions[offset + 1];
    const pz = state.positions[offset + 2];
    const vx = state.velocities[offset];
    const vy = state.velocities[offset + 1];
    const vz = state.velocities[offset + 2];

    totalMass += mass;
    kineticEnergy += 0.5 * mass * (vx * vx + vy * vy + vz * vz);
    momentum[0] += mass * vx;
    momentum[1] += mass * vy;
    momentum[2] += mass * vz;
    centerOfMass[0] += mass * px;
    centerOfMass[1] += mass * py;
    centerOfMass[2] += mass * pz;

    const lx = mass * (py * vz - pz * vy);
    const ly = mass * (pz * vx - px * vz);
    const lz = mass * (px * vy - py * vx);
    angularMomentum[0] += lx;
    angularMomentum[1] += ly;
    angularMomentum[2] += lz;
    angularMomentumScale += Math.hypot(lx, ly, lz);
  }

  if (!(totalMass > 0)) {
    throw new Error('Diagnostics require at least one massive body.');
  }
  centerOfMass[0] /= totalMass;
  centerOfMass[1] /= totalMass;
  centerOfMass[2] /= totalMass;

  let radiusSquaredSum = 0;
  for (let body = 0; body < state.count; body += 1) {
    if (state.kinds[body] !== BODY_KIND.MASSIVE) continue;
    const offset = body * 3;
    const dx = state.positions[offset] - centerOfMass[0];
    const dy = state.positions[offset + 1] - centerOfMass[1];
    const dz = state.positions[offset + 2] - centerOfMass[2];
    radiusSquaredSum += state.masses[body] * (dx * dx + dy * dy + dz * dz);
  }

  const potentialEnergy = computePotentialEnergy(
    state,
    softening,
    gravitationalConstant,
  );
  return {
    energy: kineticEnergy + potentialEnergy,
    kineticEnergy,
    potentialEnergy,
    momentum,
    angularMomentum,
    centerOfMass,
    totalMass,
    scales: {
      energy: Math.max(kineticEnergy + Math.abs(potentialEnergy), Number.EPSILON),
      angularMomentum: Math.max(angularMomentumScale, Number.EPSILON),
      length: Math.max(Math.sqrt(radiusSquaredSum / totalMass), 1),
    },
    constrained: isConstrainedState(state),
  };
}

/** @param {RuntimeState} state @param {number} softening @param {number} gravitationalConstant */
export function createDiagnosticReference(
  state,
  softening,
  gravitationalConstant,
) {
  return computeConservedQuantities(state, softening, gravitationalConstant);
}

/**
 * @param {RuntimeState} state
 * @param {ConservedQuantities} reference
 * @param {number} elapsedTime
 * @param {number} softening
 * @param {number} gravitationalConstant
 */
export function measureDiagnostics(
  state,
  reference,
  elapsedTime,
  softening,
  gravitationalConstant,
) {
  const current = computeConservedQuantities(
    state,
    softening,
    gravitationalConstant,
  );
  const energyDenominator = Math.max(
    Math.abs(reference.energy),
    reference.scales.energy * 1e-12,
    Number.EPSILON,
  );
  const energySignedError =
    (current.energy - reference.energy) / energyDenominator;
  const angularDifference = Math.hypot(
    current.angularMomentum[0] - reference.angularMomentum[0],
    current.angularMomentum[1] - reference.angularMomentum[1],
    current.angularMomentum[2] - reference.angularMomentum[2],
  );
  const expectedCenterOfMass = new Float64Array([
    reference.centerOfMass[0] +
      (reference.momentum[0] / reference.totalMass) * elapsedTime,
    reference.centerOfMass[1] +
      (reference.momentum[1] / reference.totalMass) * elapsedTime,
    reference.centerOfMass[2] +
      (reference.momentum[2] / reference.totalMass) * elapsedTime,
  ]);
  const centerOfMassDrift =
    Math.hypot(
      current.centerOfMass[0] - expectedCenterOfMass[0],
      current.centerOfMass[1] - expectedCenterOfMass[1],
      current.centerOfMass[2] - expectedCenterOfMass[2],
    ) / reference.scales.length;

  return {
    time: elapsedTime,
    energy: current.energy,
    energySignedError,
    energyError: Math.abs(energySignedError),
    angularMomentumError:
      angularDifference / reference.scales.angularMomentum,
    centerOfMassDrift,
    centerOfMass: current.centerOfMass,
    expectedCenterOfMass,
    momentum: current.momentum,
    angularMomentum: current.angularMomentum,
    constrained: reference.constrained || current.constrained,
  };
}
