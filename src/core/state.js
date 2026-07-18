import { NumericalError, ValidationError } from './errors.js';

export const BODY_KIND = Object.freeze({
  TRACER: 0,
  MASSIVE: 1,
});

/**
 * @typedef {'massive' | 'tracer'} BodyKind
 *
 * @typedef {object} Body
 * @property {number} id
 * @property {string} name
 * @property {BodyKind} kind
 * @property {number} mass
 * @property {ArrayLike<number>} position
 * @property {ArrayLike<number>} velocity
 * @property {number} [radius]
 * @property {boolean} [fixed]
 *
 * @typedef {object} RuntimeState
 * @property {number} count
 * @property {Int32Array} ids
 * @property {string[]} names
 * @property {Uint8Array} kinds
 * @property {Float64Array} masses
 * @property {Float64Array} positions
 * @property {Float64Array} velocities
 * @property {Float64Array} radii
 * @property {Uint8Array} fixed
 */

const INT32_MIN = -2_147_483_648;
const INT32_MAX = 2_147_483_647;

/** @param {ArrayLike<number>} value @param {string} label */
function assertFiniteVector(value, label) {
  if (value == null || value.length !== 3) {
    throw new ValidationError(`${label} must contain exactly three entries.`);
  }
  for (let axis = 0; axis < 3; axis += 1) {
    if (!Number.isFinite(value[axis])) {
      throw new ValidationError(`${label}[${axis}] must be finite.`);
    }
  }
}

/** @param {Body[]} bodies @returns {RuntimeState} */
export function createRuntimeState(bodies) {
  if (!Array.isArray(bodies) || bodies.length === 0) {
    throw new ValidationError('A world requires at least one body.');
  }

  const count = bodies.length;
  const state = {
    count,
    ids: new Int32Array(count),
    names: new Array(count),
    kinds: new Uint8Array(count),
    masses: new Float64Array(count),
    positions: new Float64Array(count * 3),
    velocities: new Float64Array(count * 3),
    radii: new Float64Array(count),
    fixed: new Uint8Array(count),
  };
  const seenIds = new Set();

  bodies.forEach((body, index) => {
    if (
      !Number.isInteger(body.id) ||
      body.id < INT32_MIN ||
      body.id > INT32_MAX ||
      seenIds.has(body.id)
    ) {
      throw new ValidationError(`Body id ${body.id} must be a unique int32.`);
    }
    seenIds.add(body.id);

    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      throw new ValidationError(`Body ${body.id} requires a non-empty name.`);
    }
    if (body.kind !== 'massive' && body.kind !== 'tracer') {
      throw new ValidationError(`Body ${body.id} has an invalid kind.`);
    }
    if (
      (body.kind === 'massive' && !(body.mass > 0)) ||
      (body.kind === 'tracer' && body.mass !== 0) ||
      !Number.isFinite(body.mass)
    ) {
      throw new ValidationError(
        `Body ${body.id} mass does not match its ${body.kind} kind.`,
      );
    }
    assertFiniteVector(body.position, `Body ${body.id} position`);
    assertFiniteVector(body.velocity, `Body ${body.id} velocity`);

    const radius = body.radius ?? 1;
    if (!Number.isFinite(radius) || radius <= 0) {
      throw new ValidationError(`Body ${body.id} radius must be positive.`);
    }

    state.ids[index] = body.id;
    state.names[index] = body.name;
    state.kinds[index] =
      body.kind === 'massive' ? BODY_KIND.MASSIVE : BODY_KIND.TRACER;
    state.masses[index] = body.mass;
    state.radii[index] = radius;
    state.fixed[index] = body.fixed === true ? 1 : 0;

    const offset = index * 3;
    for (let axis = 0; axis < 3; axis += 1) {
      state.positions[offset + axis] = body.position[axis];
      state.velocities[offset + axis] = body.velocity[axis];
    }
  });

  return state;
}

/** @param {RuntimeState} state @returns {RuntimeState} */
export function cloneRuntimeState(state) {
  return {
    count: state.count,
    ids: state.ids.slice(),
    names: state.names.slice(),
    kinds: state.kinds.slice(),
    masses: state.masses.slice(),
    positions: state.positions.slice(),
    velocities: state.velocities.slice(),
    radii: state.radii.slice(),
    fixed: state.fixed.slice(),
  };
}

/** @param {RuntimeState} target @param {RuntimeState} source */
export function copyRuntimeState(target, source) {
  if (target.count !== source.count) {
    throw new ValidationError('Cannot copy states with different body counts.');
  }
  target.ids.set(source.ids);
  target.names.splice(0, target.names.length, ...source.names);
  target.kinds.set(source.kinds);
  target.masses.set(source.masses);
  target.positions.set(source.positions);
  target.velocities.set(source.velocities);
  target.radii.set(source.radii);
  target.fixed.set(source.fixed);
}

/** @param {RuntimeState} state */
export function assertFiniteState(state) {
  if (
    state.positions.length !== state.count * 3 ||
    state.velocities.length !== state.count * 3 ||
    state.masses.length !== state.count
  ) {
    throw new NumericalError('Runtime state arrays have inconsistent lengths.');
  }

  for (let index = 0; index < state.count; index += 1) {
    const mass = state.masses[index];
    const isMassive = state.kinds[index] === BODY_KIND.MASSIVE;
    if (
      !Number.isFinite(mass) ||
      (isMassive && !(mass > 0)) ||
      (!isMassive && mass !== 0)
    ) {
      throw new NumericalError(`Body ${state.ids[index]} has invalid mass state.`);
    }
  }

  for (let index = 0; index < state.positions.length; index += 1) {
    if (
      !Number.isFinite(state.positions[index]) ||
      !Number.isFinite(state.velocities[index])
    ) {
      throw new NumericalError(`Non-finite phase-space value at offset ${index}.`);
    }
  }
}

/** @param {RuntimeState} state @returns {Body[]} */
export function runtimeStateToBodies(state) {
  return Array.from({ length: state.count }, (_, index) => {
    const offset = index * 3;
    return {
      id: state.ids[index],
      name: state.names[index],
      kind:
        state.kinds[index] === BODY_KIND.MASSIVE ? 'massive' : 'tracer',
      mass: state.masses[index],
      position: Array.from(state.positions.slice(offset, offset + 3)),
      velocity: Array.from(state.velocities.slice(offset, offset + 3)),
      radius: state.radii[index],
      fixed: state.fixed[index] === 1,
    };
  });
}

/** @param {RuntimeState} state @returns {boolean} */
export function isConstrainedState(state) {
  return state.fixed.some((value) => value === 1);
}
