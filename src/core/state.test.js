import { describe, expect, it } from 'vitest';
import { NumericalError, ValidationError } from './errors.js';
import {
  BODY_KIND,
  assertFiniteState,
  cloneRuntimeState,
  createRuntimeState,
  runtimeStateToBodies,
} from './state.js';

/** @returns {import('./state.js').Body[]} */
function validBodies() {
  return [
    {
      id: 7,
      name: 'Primary',
      kind: 'massive',
      mass: 1.25,
      position: [1, 2, 3],
      velocity: [-1, 0.5, 0],
      radius: 0.02,
      fixed: true,
    },
    {
      id: 9,
      name: 'Tracer',
      kind: 'tracer',
      mass: 0,
      position: [4, 5, 6],
      velocity: [0, 1, 2],
    },
  ];
}

describe('runtime state', () => {
  it('converts validated bodies to deterministic Float64 SoA storage', () => {
    const state = createRuntimeState(validBodies());

    expect(state.count).toBe(2);
    expect(state.ids).toBeInstanceOf(Int32Array);
    expect(state.kinds).toBeInstanceOf(Uint8Array);
    expect(state.positions).toBeInstanceOf(Float64Array);
    expect([...state.kinds]).toEqual([BODY_KIND.MASSIVE, BODY_KIND.TRACER]);
    expect([...state.positions]).toEqual([1, 2, 3, 4, 5, 6]);
    expect(runtimeStateToBodies(state)).toEqual([
      validBodies()[0],
      { ...validBodies()[1], radius: 1, fixed: false },
    ]);
  });

  it('clones every mutable array without sharing storage', () => {
    const original = createRuntimeState(validBodies());
    const clone = cloneRuntimeState(original);

    clone.positions[0] = 99;
    clone.names[0] = 'Changed';

    expect(original.positions[0]).toBe(1);
    expect(original.names[0]).toBe('Primary');
  });

  it('rejects duplicate IDs, invalid mass roles, and non-finite vectors', () => {
    const [massive, tracer] = validBodies();

    expect(() =>
      createRuntimeState([massive, { ...tracer, id: massive.id }]),
    ).toThrow(ValidationError);
    expect(() => createRuntimeState([{ ...massive, mass: -1 }])).toThrow(
      ValidationError,
    );
    expect(() => createRuntimeState([{ ...tracer, mass: 1 }])).toThrow(
      ValidationError,
    );
    expect(() =>
      createRuntimeState([{ ...massive, position: [0, Number.NaN, 0] }]),
    ).toThrow(ValidationError);
  });

  it('detects non-finite phase-space corruption', () => {
    const state = createRuntimeState(validBodies());
    state.velocities[4] = Number.POSITIVE_INFINITY;

    expect(() => assertFiniteState(state)).toThrow(NumericalError);
  });
});
