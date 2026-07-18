import { ValidationError } from './errors.js';
import { cross, dot, magnitude, vec3 } from './vec.js';

const TWO_PI = 2 * Math.PI;
const ELEMENT_TOLERANCE = 1e-12;

/** @param {number} angle */
export function normalizeAngle(angle) {
  const normalized = angle % TWO_PI;
  return normalized < 0 ? normalized + TWO_PI : normalized;
}

/** @param {number} value */
function clampUnit(value) {
  return Math.max(-1, Math.min(1, value));
}

/**
 * Solve M = E - e sin(E) for an elliptic orbit.
 * @param {number} meanAnomaly
 * @param {number} eccentricity
 * @param {number} [tolerance]
 */
export function solveEccentricAnomaly(
  meanAnomaly,
  eccentricity,
  tolerance = 1e-14,
) {
  if (
    !Number.isFinite(meanAnomaly) ||
    !Number.isFinite(eccentricity) ||
    eccentricity < 0 ||
    eccentricity >= 1
  ) {
    throw new ValidationError(
      'Elliptic anomaly solving requires finite M and 0 ≤ e < 1.',
    );
  }
  const mean = normalizeAngle(meanAnomaly);
  let eccentric = eccentricity < 0.8 ? mean : Math.PI;

  for (let iteration = 0; iteration < 32; iteration += 1) {
    const residual = eccentric - eccentricity * Math.sin(eccentric) - mean;
    const derivative = 1 - eccentricity * Math.cos(eccentric);
    const delta = residual / derivative;
    eccentric -= delta;
    if (Math.abs(delta) <= tolerance) return normalizeAngle(eccentric);
  }

  let lower = 0;
  let upper = TWO_PI;
  for (let iteration = 0; iteration < 96; iteration += 1) {
    eccentric = (lower + upper) * 0.5;
    const residual = eccentric - eccentricity * Math.sin(eccentric) - mean;
    if (Math.abs(residual) <= tolerance) return normalizeAngle(eccentric);
    if (residual > 0) upper = eccentric;
    else lower = eccentric;
  }
  throw new ValidationError('Eccentric anomaly solver did not converge.');
}

/** @param {number} eccentricAnomaly @param {number} eccentricity */
function eccentricToTrueAnomaly(eccentricAnomaly, eccentricity) {
  return normalizeAngle(
    Math.atan2(
      Math.sqrt(1 - eccentricity * eccentricity) *
        Math.sin(eccentricAnomaly),
      Math.cos(eccentricAnomaly) - eccentricity,
    ),
  );
}

/**
 * @typedef {object} KeplerElements
 * @property {number} a
 * @property {number} e
 * @property {number} i
 * @property {number} Omega
 * @property {number} omega
 * @property {{type: 'true' | 'mean', value: number}} anomaly
 * @property {number} [primaryId]
 */

/** @param {KeplerElements} elements @param {number} gravitationalParameter */
export function elementsToState(elements, gravitationalParameter) {
  if (!Number.isFinite(gravitationalParameter) || gravitationalParameter <= 0) {
    throw new ValidationError('Kepler conversion requires positive μ.');
  }
  if (
    !Number.isFinite(elements.a) ||
    elements.a <= 0 ||
    !Number.isFinite(elements.e) ||
    elements.e < 0 ||
    elements.e >= 1
  ) {
    throw new ValidationError('v1 Kepler elements require a > 0 and 0 ≤ e < 1.');
  }
  for (const angle of [elements.i, elements.Omega, elements.omega]) {
    if (!Number.isFinite(angle)) {
      throw new ValidationError('Kepler angles must be finite.');
    }
  }
  if (
    !elements.anomaly ||
    (elements.anomaly.type !== 'true' && elements.anomaly.type !== 'mean') ||
    !Number.isFinite(elements.anomaly.value)
  ) {
    throw new ValidationError('Kepler anomaly must explicitly be true or mean.');
  }

  const trueAnomaly =
    elements.anomaly.type === 'true'
      ? normalizeAngle(elements.anomaly.value)
      : eccentricToTrueAnomaly(
          solveEccentricAnomaly(elements.anomaly.value, elements.e),
          elements.e,
        );
  const parameter = elements.a * (1 - elements.e * elements.e);
  const radius = parameter / (1 + elements.e * Math.cos(trueAnomaly));
  const speedScale = Math.sqrt(gravitationalParameter / parameter);
  const perifocalPosition = vec3(
    radius * Math.cos(trueAnomaly),
    radius * Math.sin(trueAnomaly),
    0,
  );
  const perifocalVelocity = vec3(
    -speedScale * Math.sin(trueAnomaly),
    speedScale * (elements.e + Math.cos(trueAnomaly)),
    0,
  );

  const cosNode = Math.cos(elements.Omega);
  const sinNode = Math.sin(elements.Omega);
  const cosInclination = Math.cos(elements.i);
  const sinInclination = Math.sin(elements.i);
  const cosPeriapsis = Math.cos(elements.omega);
  const sinPeriapsis = Math.sin(elements.omega);
  const rotation = [
    cosNode * cosPeriapsis - sinNode * sinPeriapsis * cosInclination,
    -cosNode * sinPeriapsis - sinNode * cosPeriapsis * cosInclination,
    sinNode * sinInclination,
    sinNode * cosPeriapsis + cosNode * sinPeriapsis * cosInclination,
    -sinNode * sinPeriapsis + cosNode * cosPeriapsis * cosInclination,
    -cosNode * sinInclination,
    sinPeriapsis * sinInclination,
    cosPeriapsis * sinInclination,
    cosInclination,
  ];

  /** @param {Float64Array} value */
  const rotate = (value) =>
    vec3(
      rotation[0] * value[0] + rotation[1] * value[1] + rotation[2] * value[2],
      rotation[3] * value[0] + rotation[4] * value[1] + rotation[5] * value[2],
      rotation[6] * value[0] + rotation[7] * value[1] + rotation[8] * value[2],
    );

  return {
    position: rotate(perifocalPosition),
    velocity: rotate(perifocalVelocity),
    primaryId: elements.primaryId ?? null,
  };
}

/**
 * @param {Float64Array} position
 * @param {Float64Array} velocity
 * @param {number} gravitationalParameter
 * @param {number | null} [primaryId]
 * @returns {KeplerElements}
 */
export function stateToElements(
  position,
  velocity,
  gravitationalParameter,
  primaryId = null,
) {
  if (!Number.isFinite(gravitationalParameter) || gravitationalParameter <= 0) {
    throw new ValidationError('Kepler conversion requires positive μ.');
  }
  const radius = magnitude(position);
  if (!(radius > 0)) {
    throw new ValidationError('Kepler conversion requires nonzero position.');
  }

  const angularMomentum = vec3();
  cross(angularMomentum, position, velocity);
  const angularMomentumMagnitude = magnitude(angularMomentum);
  if (!(angularMomentumMagnitude > ELEMENT_TOLERANCE)) {
    throw new ValidationError('Radial states do not define v1 Kepler elements.');
  }
  const node = vec3(-angularMomentum[1], angularMomentum[0], 0);
  const nodeMagnitude = magnitude(node);
  const velocityCrossH = vec3();
  cross(velocityCrossH, velocity, angularMomentum);
  const eccentricityVector = vec3(
    velocityCrossH[0] / gravitationalParameter - position[0] / radius,
    velocityCrossH[1] / gravitationalParameter - position[1] / radius,
    velocityCrossH[2] / gravitationalParameter - position[2] / radius,
  );
  const eccentricity = magnitude(eccentricityVector);
  const specificEnergy =
    0.5 * dot(velocity, velocity) - gravitationalParameter / radius;
  if (!(specificEnergy < 0) || eccentricity >= 1) {
    throw new ValidationError('v1 reverse conversion supports elliptic states only.');
  }

  const semiMajorAxis = -gravitationalParameter / (2 * specificEnergy);
  const inclination = Math.acos(
    clampUnit(angularMomentum[2] / angularMomentumMagnitude),
  );
  let ascendingNode =
    nodeMagnitude > ELEMENT_TOLERANCE
      ? normalizeAngle(Math.atan2(node[1], node[0]))
      : 0;
  let periapsis = 0;
  /** @type {number} */
  let trueAnomaly;

  if (eccentricity > ELEMENT_TOLERANCE) {
    if (nodeMagnitude > ELEMENT_TOLERANCE) {
      periapsis = Math.acos(
        clampUnit(dot(node, eccentricityVector) / (nodeMagnitude * eccentricity)),
      );
      if (eccentricityVector[2] < 0) periapsis = TWO_PI - periapsis;
    } else {
      ascendingNode = 0;
      periapsis = normalizeAngle(
        Math.atan2(eccentricityVector[1], eccentricityVector[0]),
      );
    }
    trueAnomaly = Math.acos(
      clampUnit(dot(eccentricityVector, position) / (eccentricity * radius)),
    );
    if (dot(position, velocity) < 0) trueAnomaly = TWO_PI - trueAnomaly;
  } else if (nodeMagnitude > ELEMENT_TOLERANCE) {
    trueAnomaly = Math.acos(
      clampUnit(dot(node, position) / (nodeMagnitude * radius)),
    );
    if (position[2] < 0) trueAnomaly = TWO_PI - trueAnomaly;
  } else {
    trueAnomaly = normalizeAngle(Math.atan2(position[1], position[0]));
  }

  return {
    a: semiMajorAxis,
    e: eccentricity,
    i: inclination,
    Omega: normalizeAngle(ascendingNode),
    omega: normalizeAngle(periapsis),
    anomaly: { type: 'true', value: normalizeAngle(trueAnomaly) },
    ...(primaryId == null ? {} : { primaryId }),
  };
}
