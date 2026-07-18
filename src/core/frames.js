import { ValidationError } from './errors.js';
import { BODY_KIND } from './state.js';

/** @typedef {import('./state.js').RuntimeState} RuntimeState */

/**
 * @typedef {object} BarycentricFrame
 * @property {Float64Array} originPosition
 * @property {Float64Array} originVelocity
 *
 * @typedef {object} RotatingFrame
 * @property {Float64Array} originPosition
 * @property {Float64Array} originVelocity
 * @property {number} epochTime
 * @property {number} epochAngle
 * @property {number} angularVelocity
 */

/** @param {ArrayLike<number>} value @param {string} label */
function assertVector(value, label) {
  if (value == null || value.length !== 3) {
    throw new ValidationError(`${label} must have three components.`);
  }
  for (let axis = 0; axis < 3; axis += 1) {
    if (!Number.isFinite(value[axis])) {
      throw new ValidationError(`${label}[${axis}] must be finite.`);
    }
  }
}

/** @param {ArrayLike<number>} value */
function copyVector(value) {
  return new Float64Array([value[0], value[1], value[2]]);
}

/** @param {RuntimeState} state @returns {BarycentricFrame} */
export function computeBarycentricFrame(state) {
  const originPosition = new Float64Array(3);
  const originVelocity = new Float64Array(3);
  let totalMass = 0;
  for (let body = 0; body < state.count; body += 1) {
    if (state.kinds[body] !== BODY_KIND.MASSIVE) continue;
    const mass = state.masses[body];
    const offset = body * 3;
    totalMass += mass;
    for (let axis = 0; axis < 3; axis += 1) {
      originPosition[axis] += mass * state.positions[offset + axis];
      originVelocity[axis] += mass * state.velocities[offset + axis];
    }
  }
  if (!(totalMass > 0)) {
    throw new ValidationError('A barycentric frame requires massive bodies.');
  }
  for (let axis = 0; axis < 3; axis += 1) {
    originPosition[axis] /= totalMass;
    originVelocity[axis] /= totalMass;
  }
  return { originPosition, originVelocity };
}

/**
 * @param {ArrayLike<number>} position
 * @param {ArrayLike<number>} velocity
 * @param {BarycentricFrame} frame
 * @param {Float64Array} [outPosition]
 * @param {Float64Array} [outVelocity]
 */
export function inertialToBarycentric(
  position,
  velocity,
  frame,
  outPosition = new Float64Array(3),
  outVelocity = new Float64Array(3),
) {
  assertVector(position, 'Position');
  assertVector(velocity, 'Velocity');
  for (let axis = 0; axis < 3; axis += 1) {
    outPosition[axis] = position[axis] - frame.originPosition[axis];
    outVelocity[axis] = velocity[axis] - frame.originVelocity[axis];
  }
  return { position: outPosition, velocity: outVelocity };
}

/**
 * @param {ArrayLike<number>} position
 * @param {ArrayLike<number>} velocity
 * @param {BarycentricFrame} frame
 * @param {Float64Array} [outPosition]
 * @param {Float64Array} [outVelocity]
 */
export function barycentricToInertial(
  position,
  velocity,
  frame,
  outPosition = new Float64Array(3),
  outVelocity = new Float64Array(3),
) {
  assertVector(position, 'Position');
  assertVector(velocity, 'Velocity');
  for (let axis = 0; axis < 3; axis += 1) {
    outPosition[axis] = position[axis] + frame.originPosition[axis];
    outVelocity[axis] = velocity[axis] + frame.originVelocity[axis];
  }
  return { position: outPosition, velocity: outVelocity };
}

/**
 * @param {{originPosition?: ArrayLike<number>, originVelocity?: ArrayLike<number>, epochTime?: number, epochAngle?: number, angularVelocity: number}} config
 * @returns {RotatingFrame}
 */
export function createRotatingFrame(config) {
  const originPosition = config.originPosition ?? [0, 0, 0];
  const originVelocity = config.originVelocity ?? [0, 0, 0];
  const epochTime = config.epochTime ?? 0;
  const epochAngle = config.epochAngle ?? 0;
  assertVector(originPosition, 'Frame origin position');
  assertVector(originVelocity, 'Frame origin velocity');
  if (
    !Number.isFinite(epochTime) ||
    !Number.isFinite(epochAngle) ||
    !Number.isFinite(config.angularVelocity)
  ) {
    throw new ValidationError('Rotating-frame time, angle, and rate must be finite.');
  }
  return {
    originPosition: copyVector(originPosition),
    originVelocity: copyVector(originVelocity),
    epochTime,
    epochAngle,
    angularVelocity: config.angularVelocity,
  };
}

/**
 * Infer the instantaneous barycentric planar rotation from a primary pair.
 * @param {ArrayLike<number>} primaryPosition
 * @param {ArrayLike<number>} primaryVelocity
 * @param {number} primaryMass
 * @param {ArrayLike<number>} secondaryPosition
 * @param {ArrayLike<number>} secondaryVelocity
 * @param {number} secondaryMass
 * @param {number} [epochTime]
 * @returns {RotatingFrame}
 */
export function createPrimaryPairFrame(
  primaryPosition,
  primaryVelocity,
  primaryMass,
  secondaryPosition,
  secondaryVelocity,
  secondaryMass,
  epochTime = 0,
) {
  assertVector(primaryPosition, 'Primary position');
  assertVector(primaryVelocity, 'Primary velocity');
  assertVector(secondaryPosition, 'Secondary position');
  assertVector(secondaryVelocity, 'Secondary velocity');
  if (
    !Number.isFinite(primaryMass) ||
    !Number.isFinite(secondaryMass) ||
    !(primaryMass > 0) ||
    !(secondaryMass > 0)
  ) {
    throw new ValidationError('Primary-pair masses must be finite and positive.');
  }
  const totalMass = primaryMass + secondaryMass;
  const originPosition = new Float64Array(3);
  const originVelocity = new Float64Array(3);
  for (let axis = 0; axis < 3; axis += 1) {
    originPosition[axis] =
      (primaryMass * primaryPosition[axis] +
        secondaryMass * secondaryPosition[axis]) /
      totalMass;
    originVelocity[axis] =
      (primaryMass * primaryVelocity[axis] +
        secondaryMass * secondaryVelocity[axis]) /
      totalMass;
  }
  const dx = secondaryPosition[0] - primaryPosition[0];
  const dy = secondaryPosition[1] - primaryPosition[1];
  const dvx = secondaryVelocity[0] - primaryVelocity[0];
  const dvy = secondaryVelocity[1] - primaryVelocity[1];
  const planarDistanceSquared = dx * dx + dy * dy;
  if (!(planarDistanceSquared > 0)) {
    throw new ValidationError('Primary pair requires nonzero planar separation.');
  }
  return createRotatingFrame({
    originPosition,
    originVelocity,
    epochTime,
    epochAngle: Math.atan2(dy, dx),
    angularVelocity: (dx * dvy - dy * dvx) / planarDistanceSquared,
  });
}

/** @param {RotatingFrame} frame @param {number} time */
function framePose(frame, time) {
  if (!Number.isFinite(time)) {
    throw new ValidationError('Frame transform time must be finite.');
  }
  const elapsed = time - frame.epochTime;
  return {
    angle: frame.epochAngle + frame.angularVelocity * elapsed,
    originX: frame.originPosition[0] + frame.originVelocity[0] * elapsed,
    originY: frame.originPosition[1] + frame.originVelocity[1] * elapsed,
    originZ: frame.originPosition[2] + frame.originVelocity[2] * elapsed,
  };
}

/**
 * @param {ArrayLike<number>} position
 * @param {ArrayLike<number>} velocity
 * @param {number} time
 * @param {RotatingFrame} frame
 * @param {Float64Array} [outPosition]
 * @param {Float64Array} [outVelocity]
 */
export function inertialToRotating(
  position,
  velocity,
  time,
  frame,
  outPosition = new Float64Array(3),
  outVelocity = new Float64Array(3),
) {
  assertVector(position, 'Position');
  assertVector(velocity, 'Velocity');
  const pose = framePose(frame, time);
  const cosine = Math.cos(pose.angle);
  const sine = Math.sin(pose.angle);
  const dx = position[0] - pose.originX;
  const dy = position[1] - pose.originY;
  const dz = position[2] - pose.originZ;
  const relativeVx = velocity[0] - frame.originVelocity[0];
  const relativeVy = velocity[1] - frame.originVelocity[1];
  const relativeVz = velocity[2] - frame.originVelocity[2];
  const rotatedVx = cosine * relativeVx + sine * relativeVy;
  const rotatedVy = -sine * relativeVx + cosine * relativeVy;

  outPosition[0] = cosine * dx + sine * dy;
  outPosition[1] = -sine * dx + cosine * dy;
  outPosition[2] = dz;
  outVelocity[0] = rotatedVx + frame.angularVelocity * outPosition[1];
  outVelocity[1] = rotatedVy - frame.angularVelocity * outPosition[0];
  outVelocity[2] = relativeVz;
  return { position: outPosition, velocity: outVelocity };
}

/**
 * @param {ArrayLike<number>} position
 * @param {ArrayLike<number>} velocity
 * @param {number} time
 * @param {RotatingFrame} frame
 * @param {Float64Array} [outPosition]
 * @param {Float64Array} [outVelocity]
 */
export function rotatingToInertial(
  position,
  velocity,
  time,
  frame,
  outPosition = new Float64Array(3),
  outVelocity = new Float64Array(3),
) {
  assertVector(position, 'Position');
  assertVector(velocity, 'Velocity');
  const pose = framePose(frame, time);
  const cosine = Math.cos(pose.angle);
  const sine = Math.sin(pose.angle);
  const inertialRelativeVx = velocity[0] - frame.angularVelocity * position[1];
  const inertialRelativeVy = velocity[1] + frame.angularVelocity * position[0];

  outPosition[0] =
    pose.originX + cosine * position[0] - sine * position[1];
  outPosition[1] =
    pose.originY + sine * position[0] + cosine * position[1];
  outPosition[2] = pose.originZ + position[2];
  outVelocity[0] =
    frame.originVelocity[0] +
    cosine * inertialRelativeVx -
    sine * inertialRelativeVy;
  outVelocity[1] =
    frame.originVelocity[1] +
    sine * inertialRelativeVx +
    cosine * inertialRelativeVy;
  outVelocity[2] = frame.originVelocity[2] + velocity[2];
  return { position: outPosition, velocity: outVelocity };
}
