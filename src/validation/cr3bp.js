import {
  jacobiConstant,
  physicalRotatingToCanonical,
} from '../core/cr3bp.js';
import { NumericalError, ValidationError } from '../core/errors.js';
import { inertialToRotating } from '../core/frames.js';
import { createWorld, stepWorld } from '../core/world.js';

/** @typedef {import('../scenarios/cr3bp.js').Cr3bpPreset} Cr3bpPreset */

/** @param {Cr3bpPreset} preset @param {import('../core/world.js').World} world */
function canonicalTracerState(preset, world) {
  const offset = preset.tracerIndex * 3;
  const inertialPosition = world.state.positions.subarray(offset, offset + 3);
  const inertialVelocity = world.state.velocities.subarray(offset, offset + 3);
  const rotating = inertialToRotating(
    inertialPosition,
    inertialVelocity,
    world.time,
    preset.rotatingFrame,
  );
  return physicalRotatingToCanonical(
    rotating.position,
    rotating.velocity,
    preset.normalization,
  );
}

/** @param {number} mu @param {ArrayLike<number>} position */
function minimumPrimaryDistance(mu, position) {
  return Math.min(
    Math.hypot(position[0] + mu, position[1], position[2]),
    Math.hypot(position[0] - (1 - mu), position[1], position[2]),
  );
}

/**
 * @param {Cr3bpPreset} preset
 * @param {{periods?: number, stepsPerPeriod?: number, sampleEvery?: number}} [options]
 */
export function runCr3bpJacobiExperiment(preset, options = {}) {
  const periods = options.periods ?? preset.recommendedPeriods;
  const stepsPerPeriod = options.stepsPerPeriod ?? Math.round(
    preset.referencePeriod / preset.config.dt,
  );
  if (
    !Number.isFinite(periods) ||
    !(periods > 0) ||
    !Number.isInteger(stepsPerPeriod) ||
    stepsPerPeriod < 64
  ) {
    throw new ValidationError('CR3BP experiment span/resolution is invalid.');
  }
  const totalSteps = Math.round(periods * stepsPerPeriod);
  const sampleEvery = Math.max(
    1,
    options.sampleEvery ?? Math.ceil(stepsPerPeriod / 32),
  );
  const world = createWorld(preset.bodies, {
    ...preset.config,
    dt: preset.referencePeriod / stepsPerPeriod,
  });
  let maximumJacobiError = 0;
  let maximumRadius = 0;
  let minimumDistance = Number.POSITIVE_INFINITY;
  let sampleCount = 0;

  const sample = () => {
    const canonical = canonicalTracerState(preset, world);
    const jacobi = jacobiConstant(
      preset.normalization.mu,
      canonical.position,
      canonical.velocity,
    );
    maximumJacobiError = Math.max(
      maximumJacobiError,
      Math.abs(jacobi - preset.referenceJacobi),
    );
    maximumRadius = Math.max(
      maximumRadius,
      Math.hypot(...canonical.position),
    );
    minimumDistance = Math.min(
      minimumDistance,
      minimumPrimaryDistance(preset.normalization.mu, canonical.position),
    );
    sampleCount += 1;
    return canonical;
  };

  let finalState = sample();
  while (world.step < totalSteps) {
    const batch = Math.min(sampleEvery, totalSteps - world.step);
    const result = stepWorld(world, batch);
    if (!result.ok) {
      throw new NumericalError(
        `${preset.id} failed at step ${world.step}: ${result.error?.message ?? 'unknown error'}`,
      );
    }
    finalState = sample();
  }
  // The loop retains the canonical state from its final committed batch.
  let recurrenceSquared = 0;
  for (let axis = 0; axis < 3; axis += 1) {
    const positionError =
      finalState.position[axis] - preset.canonicalInitialState.position[axis];
    const velocityError =
      finalState.velocity[axis] - preset.canonicalInitialState.velocity[axis];
    recurrenceSquared +=
      positionError * positionError + velocityError * velocityError;
  }

  return {
    presetId: preset.id,
    periods,
    stepsPerPeriod,
    totalSteps,
    sampleCount,
    maximumJacobiError,
    maximumRadius,
    minimumPrimaryDistance: minimumDistance,
    recurrenceError: Math.sqrt(recurrenceSquared / 6),
    finite:
      world.state.positions.every(Number.isFinite) &&
      world.state.velocities.every(Number.isFinite),
  };
}
