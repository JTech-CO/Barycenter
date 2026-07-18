/** @typedef {Float64Array} Vec3 */

const VECTOR_SIZE = 3;

/**
 * @param {number} [x]
 * @param {number} [y]
 * @param {number} [z]
 * @returns {Vec3}
 */
export function vec3(x = 0, y = 0, z = 0) {
  return new Float64Array([x, y, z]);
}

/** @param {Vec3} value */
export function assertVec3(value) {
  if (!(value instanceof Float64Array) || value.length !== VECTOR_SIZE) {
    throw new TypeError('Expected a Float64Array with exactly three entries.');
  }
}

/** @param {Vec3} out @param {Vec3} value @returns {Vec3} */
export function copy(out, value) {
  assertVec3(out);
  assertVec3(value);
  out.set(value);
  return out;
}

/** @param {Vec3} out @param {Vec3} a @param {Vec3} b @returns {Vec3} */
export function add(out, a, b) {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  out[2] = a[2] + b[2];
  return out;
}

/** @param {Vec3} out @param {Vec3} a @param {Vec3} b @returns {Vec3} */
export function subtract(out, a, b) {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
  return out;
}

/** @param {Vec3} out @param {Vec3} value @param {number} scalar @returns {Vec3} */
export function scale(out, value, scalar) {
  out[0] = value[0] * scalar;
  out[1] = value[1] * scalar;
  out[2] = value[2] * scalar;
  return out;
}

/** @param {Vec3} a @param {Vec3} b @returns {number} */
export function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** @param {Vec3} out @param {Vec3} a @param {Vec3} b @returns {Vec3} */
export function cross(out, a, b) {
  const x = a[1] * b[2] - a[2] * b[1];
  const y = a[2] * b[0] - a[0] * b[2];
  const z = a[0] * b[1] - a[1] * b[0];
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

/** @param {Vec3} value @returns {number} */
export function magnitudeSquared(value) {
  return dot(value, value);
}

/** @param {Vec3} value @returns {number} */
export function magnitude(value) {
  return Math.sqrt(magnitudeSquared(value));
}

/** @param {Vec3} out @param {Vec3} value @returns {Vec3} */
export function normalize(out, value) {
  const length = magnitude(value);
  if (!Number.isFinite(length) || length <= Number.EPSILON) {
    throw new RangeError('Cannot normalize a zero-length or non-finite vector.');
  }
  return scale(out, value, 1 / length);
}

/** @param {Vec3} value @returns {boolean} */
export function isFiniteVec3(value) {
  return (
    value.length === VECTOR_SIZE &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1]) &&
    Number.isFinite(value[2])
  );
}

/** @param {Vec3} a @param {Vec3} b @param {number} tolerance @returns {boolean} */
export function equalsWithin(a, b, tolerance) {
  return (
    Math.abs(a[0] - b[0]) <= tolerance &&
    Math.abs(a[1] - b[1]) <= tolerance &&
    Math.abs(a[2] - b[2]) <= tolerance
  );
}
