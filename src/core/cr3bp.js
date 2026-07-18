import { NumericalError, ValidationError } from './errors.js';
import { GRAVITATIONAL_CONSTANT } from './units.js';

/**
 * @typedef {object} Cr3bpNormalization
 * @property {number} primaryMass
 * @property {number} secondaryMass
 * @property {number} totalMass
 * @property {number} mu
 * @property {number} lengthScale
 * @property {number} timeScale
 * @property {number} velocityScale
 * @property {number} angularVelocity
 * @property {number} gravitationalConstant
 *
 * @typedef {object} LagrangePointSolution
 * @property {'L1' | 'L2' | 'L3' | 'L4' | 'L5'} label
 * @property {Float64Array} position
 * @property {number} residual
 * @property {number} iterations
 * @property {[number, number] | null} bracket
 */

const SQRT_THREE_OVER_TWO = Math.sqrt(3) / 2;

/** Error retaining the failed point, bracket, and solver reason. */
export class LagrangePointSolveError extends NumericalError {
  /**
   * @param {string} message
   * @param {{label: string, reason: string, lower: number, upper: number, fLower: number, fUpper: number, iterations: number}} details
   */
  constructor(message, details) {
    super(message);
    this.name = 'LagrangePointSolveError';
    this.details = details;
  }
}

/** @param {number} mu */
export function assertCr3bpMassRatio(mu) {
  if (!Number.isFinite(mu) || !(mu > 0) || mu > 0.5) {
    throw new ValidationError('CR3BP mass ratio μ must satisfy 0 < μ ≤ 0.5.');
  }
}

/**
 * @param {{primaryMass: number, secondaryMass: number, separation: number, gravitationalConstant?: number}} config
 * @returns {Cr3bpNormalization}
 */
export function createCr3bpNormalization(config) {
  const gravitationalConstant =
    config.gravitationalConstant ?? GRAVITATIONAL_CONSTANT;
  if (
    !Number.isFinite(config.primaryMass) ||
    !Number.isFinite(config.secondaryMass) ||
    !(config.primaryMass > 0) ||
    !(config.secondaryMass > 0) ||
    config.secondaryMass > config.primaryMass
  ) {
    throw new ValidationError(
      'CR3BP requires positive masses with secondaryMass ≤ primaryMass.',
    );
  }
  if (!Number.isFinite(config.separation) || !(config.separation > 0)) {
    throw new ValidationError('CR3BP separation must be finite and positive.');
  }
  if (!Number.isFinite(gravitationalConstant) || !(gravitationalConstant > 0)) {
    throw new ValidationError('CR3BP gravitational constant must be positive.');
  }
  const totalMass = config.primaryMass + config.secondaryMass;
  const mu = config.secondaryMass / totalMass;
  assertCr3bpMassRatio(mu);
  const angularVelocity = Math.sqrt(
    (gravitationalConstant * totalMass) / config.separation ** 3,
  );
  return {
    primaryMass: config.primaryMass,
    secondaryMass: config.secondaryMass,
    totalMass,
    mu,
    lengthScale: config.separation,
    timeScale: 1 / angularVelocity,
    velocityScale: config.separation * angularVelocity,
    angularVelocity,
    gravitationalConstant,
  };
}

/** @param {ArrayLike<number>} value @param {string} label */
function assertStateVector(value, label) {
  if (value == null || value.length !== 3) {
    throw new ValidationError(`${label} must have three components.`);
  }
  for (let axis = 0; axis < 3; axis += 1) {
    if (!Number.isFinite(value[axis])) {
      throw new ValidationError(`${label}[${axis}] must be finite.`);
    }
  }
}

/**
 * @param {ArrayLike<number>} position
 * @param {ArrayLike<number>} velocity
 * @param {Cr3bpNormalization} normalization
 * @param {Float64Array} [outPosition]
 * @param {Float64Array} [outVelocity]
 */
export function physicalRotatingToCanonical(
  position,
  velocity,
  normalization,
  outPosition = new Float64Array(3),
  outVelocity = new Float64Array(3),
) {
  assertStateVector(position, 'Physical rotating position');
  assertStateVector(velocity, 'Physical rotating velocity');
  for (let axis = 0; axis < 3; axis += 1) {
    outPosition[axis] = position[axis] / normalization.lengthScale;
    outVelocity[axis] = velocity[axis] / normalization.velocityScale;
  }
  return { position: outPosition, velocity: outVelocity };
}

/**
 * @param {ArrayLike<number>} position
 * @param {ArrayLike<number>} velocity
 * @param {Cr3bpNormalization} normalization
 * @param {Float64Array} [outPosition]
 * @param {Float64Array} [outVelocity]
 */
export function canonicalToPhysicalRotating(
  position,
  velocity,
  normalization,
  outPosition = new Float64Array(3),
  outVelocity = new Float64Array(3),
) {
  assertStateVector(position, 'Canonical position');
  assertStateVector(velocity, 'Canonical velocity');
  for (let axis = 0; axis < 3; axis += 1) {
    outPosition[axis] = position[axis] * normalization.lengthScale;
    outVelocity[axis] = velocity[axis] * normalization.velocityScale;
  }
  return { position: outPosition, velocity: outVelocity };
}

/**
 * @param {number} mu
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} minimumDistance
 */
function distances(mu, x, y, z, minimumDistance) {
  assertCr3bpMassRatio(mu);
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(z) ||
    !Number.isFinite(minimumDistance) ||
    minimumDistance < 0
  ) {
    throw new ValidationError('CR3BP coordinates and distance floor must be finite.');
  }
  const primaryDx = x + mu;
  const secondaryDx = x - (1 - mu);
  const primarySquared = primaryDx ** 2 + y ** 2 + z ** 2;
  const secondarySquared = secondaryDx ** 2 + y ** 2 + z ** 2;
  if (minimumDistance === 0 && (!(primarySquared > 0) || !(secondarySquared > 0))) {
    throw new NumericalError('CR3BP potential is singular at a primary body.');
  }
  const floorSquared = minimumDistance * minimumDistance;
  return {
    primaryDx,
    secondaryDx,
    r1: Math.sqrt(Math.max(primarySquared, floorSquared)),
    r2: Math.sqrt(Math.max(secondarySquared, floorSquared)),
  };
}

/**
 * Canonical pseudo-potential Ω.
 * @param {number} mu
 * @param {number} x
 * @param {number} y
 * @param {number} [z]
 * @param {number} [minimumDistance]
 */
export function effectivePotential(mu, x, y, z = 0, minimumDistance = 0) {
  const radii = distances(mu, x, y, z, minimumDistance);
  return (
    0.5 * (x * x + y * y) +
    (1 - mu) / radii.r1 +
    mu / radii.r2
  );
}

/**
 * Analytic ∇Ω.
 * @param {number} mu
 * @param {number} x
 * @param {number} y
 * @param {number} [z]
 * @param {Float64Array} [out]
 * @param {number} [minimumDistance]
 */
export function effectivePotentialGradient(
  mu,
  x,
  y,
  z = 0,
  out = new Float64Array(3),
  minimumDistance = 0,
) {
  const radii = distances(mu, x, y, z, minimumDistance);
  const primaryKernel = (1 - mu) / radii.r1 ** 3;
  const secondaryKernel = mu / radii.r2 ** 3;
  out[0] = x - primaryKernel * radii.primaryDx - secondaryKernel * radii.secondaryDx;
  out[1] = y - primaryKernel * y - secondaryKernel * y;
  out[2] = -primaryKernel * z - secondaryKernel * z;
  return out;
}

/**
 * @param {number} mu
 * @param {ArrayLike<number>} position
 * @param {ArrayLike<number>} velocity
 * @param {Float64Array} [out]
 */
export function cr3bpAcceleration(
  mu,
  position,
  velocity,
  out = new Float64Array(3),
) {
  assertStateVector(position, 'Canonical position');
  assertStateVector(velocity, 'Canonical velocity');
  const gradient = effectivePotentialGradient(
    mu,
    position[0],
    position[1],
    position[2],
  );
  out[0] = gradient[0] + 2 * velocity[1];
  out[1] = gradient[1] - 2 * velocity[0];
  out[2] = gradient[2];
  return out;
}

/**
 * @param {number} mu
 * @param {ArrayLike<number>} position
 * @param {ArrayLike<number>} velocity
 */
export function jacobiConstant(mu, position, velocity) {
  assertStateVector(position, 'Canonical position');
  assertStateVector(velocity, 'Canonical velocity');
  const speedSquared =
    velocity[0] ** 2 + velocity[1] ** 2 + velocity[2] ** 2;
  return (
    2 * effectivePotential(mu, position[0], position[1], position[2]) -
    speedSquared
  );
}

/**
 * @param {number} mu
 * @param {number} jacobi
 * @param {{xMin: number, xMax: number, yMin: number, yMax: number, width: number, height: number, z?: number, minimumDistance?: number}} options
 */
export function sampleZeroVelocityGrid(mu, jacobi, options) {
  assertCr3bpMassRatio(mu);
  if (
    !Number.isFinite(jacobi) ||
    !Number.isFinite(options.xMin) ||
    !Number.isFinite(options.xMax) ||
    !Number.isFinite(options.yMin) ||
    !Number.isFinite(options.yMax) ||
    !(options.xMax > options.xMin) ||
    !(options.yMax > options.yMin) ||
    !Number.isInteger(options.width) ||
    !Number.isInteger(options.height) ||
    options.width < 2 ||
    options.height < 2
  ) {
    throw new ValidationError('Zero-velocity grid bounds/resolution are invalid.');
  }
  const z = options.z ?? 0;
  const minimumDistance = options.minimumDistance ?? 1e-6;
  const values = new Float64Array(options.width * options.height);
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (let row = 0; row < options.height; row += 1) {
    const y =
      options.yMin +
      ((options.yMax - options.yMin) * row) / (options.height - 1);
    for (let column = 0; column < options.width; column += 1) {
      const x =
        options.xMin +
        ((options.xMax - options.xMin) * column) / (options.width - 1);
      const value =
        2 * effectivePotential(mu, x, y, z, minimumDistance) - jacobi;
      values[row * options.width + column] = value;
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
  }
  return {
    values,
    width: options.width,
    height: options.height,
    bounds: {
      xMin: options.xMin,
      xMax: options.xMax,
      yMin: options.yMin,
      yMax: options.yMax,
      z,
    },
    minimumDistance,
    minimum,
    maximum,
  };
}

/** @param {number} mu @param {number} x */
function collinearGradient(mu, x) {
  return effectivePotentialGradient(mu, x, 0, 0)[0];
}

/**
 * @param {number} mu
 * @param {'L1' | 'L2' | 'L3'} label
 * @param {{bracket?: [number, number], tolerance?: number, residualTolerance?: number, maxIterations?: number}} [options]
 * @returns {LagrangePointSolution}
 */
export function solveCollinearLagrangePoint(mu, label, options = {}) {
  assertCr3bpMassRatio(mu);
  if (label !== 'L1' && label !== 'L2' && label !== 'L3') {
    throw new ValidationError(`Unknown collinear Lagrange point: ${label}`);
  }
  const padding = 1e-10;
  const primaryX = -mu;
  const secondaryX = 1 - mu;
  const defaultBrackets = {
    L1: /** @type {[number, number]} */ ([primaryX + padding, secondaryX - padding]),
    L2: /** @type {[number, number]} */ ([secondaryX + padding, secondaryX + 2]),
    L3: /** @type {[number, number]} */ ([primaryX - 2, primaryX - padding]),
  };
  const bracket = options.bracket ?? defaultBrackets[label];
  let lower = bracket[0];
  let upper = bracket[1];
  const tolerance = options.tolerance ?? 1e-14;
  const residualTolerance = options.residualTolerance ?? 1e-13;
  const maxIterations = options.maxIterations ?? 200;
  if (
    !Number.isFinite(lower) ||
    !Number.isFinite(upper) ||
    !(upper > lower) ||
    !Number.isFinite(tolerance) ||
    !(tolerance > 0) ||
    !Number.isFinite(residualTolerance) ||
    !(residualTolerance > 0) ||
    !Number.isInteger(maxIterations) ||
    maxIterations <= 0
  ) {
    throw new ValidationError('Lagrange root options are invalid.');
  }
  let fLower = collinearGradient(mu, lower);
  let fUpper = collinearGradient(mu, upper);
  if (!Number.isFinite(fLower) || !Number.isFinite(fUpper) || fLower * fUpper > 0) {
    throw new LagrangePointSolveError(
      `${label} bracket does not straddle a finite root.`,
      {
        label,
        reason: 'invalid-bracket',
        lower,
        upper,
        fLower,
        fUpper,
        iterations: 0,
      },
    );
  }

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const midpoint = (lower + upper) * 0.5;
    const fMidpoint = collinearGradient(mu, midpoint);
    if (!Number.isFinite(fMidpoint)) {
      throw new LagrangePointSolveError(`${label} encountered a singular midpoint.`, {
        label,
        reason: 'non-finite-midpoint',
        lower,
        upper,
        fLower,
        fUpper,
        iterations: iteration,
      });
    }
    if (
      Math.abs(fMidpoint) <= residualTolerance ||
      (upper - lower) * 0.5 <= tolerance
    ) {
      return {
        label,
        position: new Float64Array([midpoint, 0, 0]),
        residual: Math.abs(fMidpoint),
        iterations: iteration,
        bracket: [bracket[0], bracket[1]],
      };
    }
    if (fLower * fMidpoint <= 0) {
      upper = midpoint;
      fUpper = fMidpoint;
    } else {
      lower = midpoint;
      fLower = fMidpoint;
    }
  }

  throw new LagrangePointSolveError(
    `${label} did not converge within ${maxIterations} iterations.`,
    {
      label,
      reason: 'max-iterations',
      lower,
      upper,
      fLower,
      fUpper,
      iterations: maxIterations,
    },
  );
}

/** @param {number} mu */
export function solveLagrangePoints(mu) {
  assertCr3bpMassRatio(mu);
  const l4Position = new Float64Array([0.5 - mu, SQRT_THREE_OVER_TWO, 0]);
  const l5Position = new Float64Array([0.5 - mu, -SQRT_THREE_OVER_TWO, 0]);
  const gradient = new Float64Array(3);
  /** @param {'L4' | 'L5'} label @param {Float64Array} position @returns {LagrangePointSolution} */
  const triangularSolution = (label, position) => {
    effectivePotentialGradient(mu, position[0], position[1], position[2], gradient);
    return {
      label,
      position,
      residual: Math.hypot(gradient[0], gradient[1], gradient[2]),
      iterations: 0,
      bracket: null,
    };
  };
  return {
    L1: solveCollinearLagrangePoint(mu, 'L1'),
    L2: solveCollinearLagrangePoint(mu, 'L2'),
    L3: solveCollinearLagrangePoint(mu, 'L3'),
    L4: triangularSolution('L4', l4Position),
    L5: triangularSolution('L5', l5Position),
  };
}
