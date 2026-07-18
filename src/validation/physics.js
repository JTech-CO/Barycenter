import { NumericalError, ValidationError } from '../core/errors.js';
import { INTEGRATORS } from '../core/integrators.js';
import { cloneRuntimeState } from '../core/state.js';
import { createWorld, stepWorld } from '../core/world.js';

/** @typedef {import('../core/state.js').RuntimeState} RuntimeState */
/** @typedef {import('../scenarios/reference.js').ReferenceFixture} ReferenceFixture */

const TWO_PI = 2 * Math.PI;

/** @param {ReferenceFixture} fixture @returns {number} */
function requireReferencePeriod(fixture) {
  const period = fixture.referencePeriod;
  if (period == null || !(period > 0)) {
    throw new ValidationError(`${fixture.id} does not define a reference period.`);
  }
  return period;
}

/** @param {number} angle */
function wrapSignedAngle(angle) {
  let wrapped = angle % TWO_PI;
  if (wrapped > Math.PI) wrapped -= TWO_PI;
  if (wrapped < -Math.PI) wrapped += TWO_PI;
  return wrapped;
}

/** @param {RuntimeState} state @param {number} left @param {number} right */
function relativePlanarState(state, left = 0, right = 1) {
  const leftOffset = left * 3;
  const rightOffset = right * 3;
  return {
    x: state.positions[rightOffset] - state.positions[leftOffset],
    y: state.positions[rightOffset + 1] - state.positions[leftOffset + 1],
    vx: state.velocities[rightOffset] - state.velocities[leftOffset],
    vy: state.velocities[rightOffset + 1] - state.velocities[leftOffset + 1],
  };
}

/** @param {RuntimeState} state */
export function minimumPairDistance(state) {
  let minimum = Number.POSITIVE_INFINITY;
  for (let left = 0; left < state.count - 1; left += 1) {
    const leftOffset = left * 3;
    for (let right = left + 1; right < state.count; right += 1) {
      const rightOffset = right * 3;
      minimum = Math.min(
        minimum,
        Math.hypot(
          state.positions[rightOffset] - state.positions[leftOffset],
          state.positions[rightOffset + 1] - state.positions[leftOffset + 1],
          state.positions[rightOffset + 2] - state.positions[leftOffset + 2],
        ),
      );
    }
  }
  return minimum;
}

/** @param {RuntimeState} state */
export function maximumOriginRadius(state) {
  let maximum = 0;
  for (let body = 0; body < state.count; body += 1) {
    const offset = body * 3;
    maximum = Math.max(
      maximum,
      Math.hypot(
        state.positions[offset],
        state.positions[offset + 1],
        state.positions[offset + 2],
      ),
    );
  }
  return maximum;
}

/**
 * Scale-normalized phase-space RMS distance. The body ordering is part of the
 * deterministic fixture contract.
 *
 * @param {RuntimeState} current
 * @param {RuntimeState} reference
 * @param {number} lengthScale
 * @param {number} velocityScale
 */
export function normalizedStateDistance(
  current,
  reference,
  lengthScale,
  velocityScale,
) {
  if (current.count !== reference.count) {
    throw new ValidationError('State distance requires matching body counts.');
  }
  const safeLengthScale = Math.max(Math.abs(lengthScale), Number.EPSILON);
  const safeVelocityScale = Math.max(Math.abs(velocityScale), Number.EPSILON);
  let squaredError = 0;
  for (let index = 0; index < current.positions.length; index += 1) {
    const positionError =
      (current.positions[index] - reference.positions[index]) / safeLengthScale;
    const velocityError =
      (current.velocities[index] - reference.velocities[index]) /
      safeVelocityScale;
    squaredError += positionError * positionError + velocityError * velocityError;
  }
  return Math.sqrt(squaredError / (current.count * 6));
}

/**
 * @param {ReferenceFixture} fixture
 * @param {{integrator?: 'leapfrog' | 'yoshida4' | 'rk4', stepsPerPeriod?: number}} [options]
 */
export function analyzeBinaryOrbit(fixture, options = {}) {
  if (fixture.bodies.length !== 2) {
    throw new ValidationError('Binary analysis requires exactly two bodies.');
  }
  const referencePeriod = requireReferencePeriod(fixture);
  const stepsPerPeriod = options.stepsPerPeriod ?? Math.round(
    referencePeriod / fixture.config.dt,
  );
  if (!Number.isInteger(stepsPerPeriod) || stepsPerPeriod < 16) {
    throw new ValidationError('Binary analysis requires at least 16 steps/period.');
  }
  const world = createWorld(fixture.bodies, {
    ...fixture.config,
    integrator: options.integrator ?? fixture.config.integrator,
    dt: referencePeriod / stepsPerPeriod,
  });
  const initial = relativePlanarState(world.state);
  let previousAngle = Math.atan2(initial.y, initial.x);
  let accumulatedAngle = 0;
  /** @type {number} */
  let previousAccumulatedAngle;
  let measuredPeriod = Number.NaN;
  let minimumRadius = Math.hypot(initial.x, initial.y);
  let maximumRadius = minimumRadius;
  let phaseError = Number.NaN;
  const totalSteps = Math.ceil(stepsPerPeriod * 1.25);

  for (let step = 1; step <= totalSteps; step += 1) {
    const result = stepWorld(world);
    if (!result.ok) {
      throw new NumericalError(
        `${fixture.id} failed at step ${world.step}: ${result.error?.message ?? 'unknown error'}`,
      );
    }
    const relative = relativePlanarState(world.state);
    const radius = Math.hypot(relative.x, relative.y);
    minimumRadius = Math.min(minimumRadius, radius);
    maximumRadius = Math.max(maximumRadius, radius);
    const angle = Math.atan2(relative.y, relative.x);
    previousAccumulatedAngle = accumulatedAngle;
    accumulatedAngle += wrapSignedAngle(angle - previousAngle);
    previousAngle = angle;

    if (step === stepsPerPeriod) {
      phaseError = Math.abs(Math.abs(accumulatedAngle) - TWO_PI);
    }
    if (!Number.isFinite(measuredPeriod) && Math.abs(accumulatedAngle) >= TWO_PI) {
      const before = Math.abs(previousAccumulatedAngle);
      const after = Math.abs(accumulatedAngle);
      const fraction = (TWO_PI - before) / (after - before);
      measuredPeriod = world.time - world.config.dt + fraction * world.config.dt;
      break;
    }
  }

  if (!Number.isFinite(measuredPeriod)) {
    throw new NumericalError(`${fixture.id} did not complete one revolution.`);
  }
  const measuredSemiMajorAxis = (minimumRadius + maximumRadius) * 0.5;
  const measuredEccentricity =
    (maximumRadius - minimumRadius) / (maximumRadius + minimumRadius);
  return {
    fixtureId: fixture.id,
    integrator: world.config.integrator,
    stepsPerPeriod,
    referencePeriod,
    measuredPeriod,
    periodRelativeError: Math.abs(measuredPeriod - referencePeriod) / referencePeriod,
    measuredSemiMajorAxis,
    semiMajorRelativeError:
      Math.abs(measuredSemiMajorAxis - fixture.expected.semiMajorAxis) /
      fixture.expected.semiMajorAxis,
    measuredEccentricity,
    eccentricityAbsoluteError: Math.abs(
      measuredEccentricity - fixture.expected.eccentricity,
    ),
    phaseError,
  };
}

/**
 * @param {ReferenceFixture} fixture
 * @param {'leapfrog' | 'yoshida4' | 'rk4'} integrator
 * @param {number} stepsPerPeriod
 */
function periodicReturnError(fixture, integrator, stepsPerPeriod) {
  const referencePeriod = requireReferencePeriod(fixture);
  const world = createWorld(fixture.bodies, {
    ...fixture.config,
    integrator,
    dt: referencePeriod / stepsPerPeriod,
  });
  const initial = cloneRuntimeState(world.state);
  const result = stepWorld(world, stepsPerPeriod);
  if (!result.ok) {
    throw new NumericalError(
      `${fixture.id} convergence run failed: ${result.error?.message ?? 'unknown error'}`,
    );
  }
  const lengthScale = world.diagnosticReference.scales.length;
  return normalizedStateDistance(
    world.state,
    initial,
    lengthScale,
    lengthScale / referencePeriod,
  );
}

/**
 * @param {ReferenceFixture} fixture
 * @param {'leapfrog' | 'yoshida4' | 'rk4'} integrator
 * @param {number[]} [stepsPerPeriod]
 */
export function runConvergenceStudy(
  fixture,
  integrator,
  stepsPerPeriod = [32, 64, 128],
) {
  if (
    stepsPerPeriod.length < 3 ||
    stepsPerPeriod.some(
      (steps, index) =>
        !Number.isInteger(steps) ||
        steps < 8 ||
        (index > 0 && steps !== stepsPerPeriod[index - 1] * 2),
    )
  ) {
    throw new ValidationError('Convergence steps must contain successive doublings.');
  }
  const errors = stepsPerPeriod.map((steps) =>
    periodicReturnError(fixture, integrator, steps),
  );
  const observedOrders = errors.slice(0, -1).map((error, index) =>
    Math.log2(error / errors[index + 1]),
  );
  return {
    fixtureId: fixture.id,
    integrator,
    stepsPerPeriod: [...stepsPerPeriod],
    errors,
    observedOrders,
  };
}

/** @param {{time: number, energySignedError: number}[]} samples */
function signedEnergyTrend(samples) {
  const count = samples.length;
  const meanTime = samples.reduce((sum, sample) => sum + sample.time, 0) / count;
  const meanError =
    samples.reduce((sum, sample) => sum + sample.energySignedError, 0) /
    count;
  let numerator = 0;
  let denominator = 0;
  for (const sample of samples) {
    const centeredTime = sample.time - meanTime;
    numerator += centeredTime * (sample.energySignedError - meanError);
    denominator += centeredTime * centeredTime;
  }
  return denominator > 0 ? numerator / denominator : 0;
}

/**
 * @param {ReferenceFixture} fixture
 * @param {{periods?: number, duration?: number, stepsPerPeriod?: number, sampleEvery?: number, integrator?: 'leapfrog' | 'yoshida4' | 'rk4'}} [options]
 */
export function runConservationExperiment(fixture, options = {}) {
  const referencePeriod = fixture.referencePeriod;
  const stepsPerPeriod = options.stepsPerPeriod ?? (
    referencePeriod == null
      ? null
      : Math.round(referencePeriod / fixture.config.dt)
  );
  const dt =
    referencePeriod != null && stepsPerPeriod != null
      ? referencePeriod / stepsPerPeriod
      : fixture.config.dt;
  const requestedDuration = options.duration ?? (
    referencePeriod != null ? (options.periods ?? 1) * referencePeriod : dt * 100
  );
  const totalSteps = Math.max(1, Math.round(requestedDuration / dt));
  const sampleEvery = Math.max(
    1,
    options.sampleEvery ?? (
      stepsPerPeriod == null ? Math.ceil(totalSteps / 100) : Math.ceil(stepsPerPeriod / 8)
    ),
  );
  const world = createWorld(fixture.bodies, {
    ...fixture.config,
    integrator: options.integrator ?? fixture.config.integrator,
    dt,
  });
  const initial = cloneRuntimeState(world.state);
  const samples = [world.diagnostics];
  let minimumSeparation = minimumPairDistance(world.state);
  let maximumRadius = maximumOriginRadius(world.state);

  while (world.step < totalSteps) {
    const batch = Math.min(sampleEvery, totalSteps - world.step);
    const result = stepWorld(world, batch);
    if (!result.ok) {
      throw new NumericalError(
        `${fixture.id} conservation run failed at step ${world.step}: ${result.error?.message ?? 'unknown error'}`,
      );
    }
    samples.push(world.diagnostics);
    minimumSeparation = Math.min(
      minimumSeparation,
      minimumPairDistance(world.state),
    );
    maximumRadius = Math.max(maximumRadius, maximumOriginRadius(world.state));
  }

  const signedErrors = samples.map((sample) => sample.energySignedError);
  const minimumEnergyError = Math.min(...signedErrors);
  const maximumEnergyError = Math.max(...signedErrors);
  const energyPeakToPeak = maximumEnergyError - minimumEnergyError;
  const trendSlope = signedEnergyTrend(samples);
  const accumulatedTime = world.time;
  const duration = totalSteps * dt;
  const trendAcrossRun = Math.abs(trendSlope) * duration;
  const lengthScale = world.diagnosticReference.scales.length;
  const velocityScale =
    referencePeriod == null ? lengthScale / Math.max(duration, dt) : lengthScale / referencePeriod;

  return {
    fixtureId: fixture.id,
    integrator: world.config.integrator,
    dt,
    totalSteps,
    duration,
    accumulatedTime,
    clockRoundoff: accumulatedTime - duration,
    periods: referencePeriod == null ? null : duration / referencePeriod,
    sampleCount: samples.length,
    energyPeakToPeak,
    maximumAbsoluteEnergyError: Math.max(
      Math.abs(minimumEnergyError),
      Math.abs(maximumEnergyError),
    ),
    signedEnergyTrend: trendSlope,
    trendAcrossRun,
    trendToEnvelope:
      energyPeakToPeak > Number.EPSILON ? trendAcrossRun / energyPeakToPeak : 0,
    maximumAngularMomentumError: Math.max(
      ...samples.map((sample) => sample.angularMomentumError),
    ),
    maximumCenterOfMassDrift: Math.max(
      ...samples.map((sample) => sample.centerOfMassDrift),
    ),
    minimumSeparation,
    maximumRadius,
    recurrenceError: normalizedStateDistance(
      world.state,
      initial,
      lengthScale,
      velocityScale,
    ),
    finite:
      world.state.positions.every(Number.isFinite) &&
      world.state.velocities.every(Number.isFinite),
  };
}

/**
 * Report-only comparison: callers may inspect drift behavior, but this function
 * deliberately imposes no assertion that RK4 drift be monotonic at a chosen dt.
 *
 * @param {ReferenceFixture} fixture
 * @param {{periods?: number, stepsPerPeriod?: number}} [options]
 */
export function compareIntegratorEnergy(fixture, options = {}) {
  const experimentOptions = {
    periods: options.periods ?? 100,
    stepsPerPeriod: options.stepsPerPeriod ?? 32,
  };
  return {
    fixtureId: fixture.id,
    experiment: experimentOptions,
    leapfrog: runConservationExperiment(fixture, {
      ...experimentOptions,
      integrator: INTEGRATORS.LEAPFROG,
    }),
    rk4: runConservationExperiment(fixture, {
      ...experimentOptions,
      integrator: INTEGRATORS.RK4,
    }),
  };
}
