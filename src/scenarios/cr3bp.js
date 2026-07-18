import {
  canonicalToPhysicalRotating,
  createCr3bpNormalization,
  jacobiConstant,
} from '../core/cr3bp.js';
import { createRotatingFrame, rotatingToInertial } from '../core/frames.js';
import { INTEGRATORS } from '../core/integrators.js';
import { normalizeSimConfig } from '../core/world.js';

/** @typedef {import('../core/state.js').Body} Body */

/**
 * @typedef {object} Cr3bpPreset
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {string} source
 * @property {ReturnType<typeof createCr3bpNormalization>} normalization
 * @property {ReturnType<typeof createRotatingFrame>} rotatingFrame
 * @property {Body[]} bodies
 * @property {ReturnType<typeof normalizeSimConfig>} config
 * @property {number} tracerIndex
 * @property {number} referencePeriod
 * @property {number} referenceJacobi
 * @property {{position: Float64Array, velocity: Float64Array}} canonicalInitialState
 * @property {{jacobiAbsolute: number, maximumRadius: number, minimumPrimaryDistance: number, recurrence: number}} tolerances
 * @property {number} recommendedPeriods
 */

export const CR3BP_PRESET_IDS = Object.freeze({
  L4_EQUILIBRIUM: 'cr3bp-l4-equilibrium',
  L4_TADPOLE: 'cr3bp-l4-tadpole',
});

/**
 * @param {string} id
 * @param {string} label
 * @param {string} description
 * @param {number} mu
 * @param {ArrayLike<number>} canonicalPosition
 * @param {ArrayLike<number>} canonicalVelocity
 * @param {number} recommendedPeriods
 * @returns {Cr3bpPreset}
 */
function createPreset(
  id,
  label,
  description,
  mu,
  canonicalPosition,
  canonicalVelocity,
  recommendedPeriods,
) {
  const normalization = createCr3bpNormalization({
    primaryMass: 1 - mu,
    secondaryMass: mu,
    separation: 1,
  });
  const rotatingFrame = createRotatingFrame({
    originPosition: [0, 0, 0],
    originVelocity: [0, 0, 0],
    epochTime: 0,
    epochAngle: 0,
    angularVelocity: normalization.angularVelocity,
  });
  const primaryX = -mu * normalization.lengthScale;
  const secondaryX = (1 - mu) * normalization.lengthScale;
  const primaryVelocityY = normalization.angularVelocity * primaryX;
  const secondaryVelocityY = normalization.angularVelocity * secondaryX;
  const canonicalInitialState = {
    position: new Float64Array(canonicalPosition),
    velocity: new Float64Array(canonicalVelocity),
  };
  const physicalRotating = canonicalToPhysicalRotating(
    canonicalInitialState.position,
    canonicalInitialState.velocity,
    normalization,
  );
  const tracerInertial = rotatingToInertial(
    physicalRotating.position,
    physicalRotating.velocity,
    0,
    rotatingFrame,
  );
  const referencePeriod = (2 * Math.PI) / normalization.angularVelocity;

  return {
    id,
    label,
    description,
    source: 'Repository-authored canonical CR3BP verification preset',
    normalization,
    rotatingFrame,
    bodies: [
      {
        id: 1,
        name: 'CR3BP Primary',
        kind: 'massive',
        mass: 1 - mu,
        position: [primaryX, 0, 0],
        velocity: [0, primaryVelocityY, 0],
        radius: 0.04,
      },
      {
        id: 2,
        name: 'CR3BP Secondary',
        kind: 'massive',
        mass: mu,
        position: [secondaryX, 0, 0],
        velocity: [0, secondaryVelocityY, 0],
        radius: 0.025,
      },
      {
        id: 3,
        name: 'Massless Probe',
        kind: 'tracer',
        mass: 0,
        position: Array.from(tracerInertial.position),
        velocity: Array.from(tracerInertial.velocity),
        radius: 0.012,
      },
    ],
    config: normalizeSimConfig({
      integrator: INTEGRATORS.YOSHIDA4,
      dt: referencePeriod / 2048,
      substeps: 1,
      softening: 0,
      G: normalization.gravitationalConstant,
    }),
    tracerIndex: 2,
    referencePeriod,
    referenceJacobi: jacobiConstant(
      mu,
      canonicalInitialState.position,
      canonicalInitialState.velocity,
    ),
    canonicalInitialState,
    tolerances: {
      jacobiAbsolute: 1e-8,
      maximumRadius: 2,
      minimumPrimaryDistance: 0.05,
      recurrence: id === CR3BP_PRESET_IDS.L4_EQUILIBRIUM ? 1e-5 : 0.1,
    },
    recommendedPeriods,
  };
}

/** @returns {Cr3bpPreset} */
export function createL4EquilibriumPreset() {
  const mu = 0.01;
  return createPreset(
    CR3BP_PRESET_IDS.L4_EQUILIBRIUM,
    'L4 equilibrium verification',
    'A massless tracer initialized at the analytic triangular equilibrium.',
    mu,
    [0.5 - mu, Math.sqrt(3) / 2, 0],
    [0, 0, 0],
    10,
  );
}

/** @returns {Cr3bpPreset} */
export function createL4TadpolePreset() {
  const mu = 0.01;
  return createPreset(
    CR3BP_PRESET_IDS.L4_TADPOLE,
    'L4 tadpole verification',
    'A small displacement from L4 producing bounded libration.',
    mu,
    [0.5 - mu + 0.015, Math.sqrt(3) / 2, 0],
    [0, 0, 0],
    20,
  );
}

/** @returns {Cr3bpPreset[]} */
export function createCr3bpPresets() {
  return [createL4EquilibriumPreset(), createL4TadpolePreset()];
}
