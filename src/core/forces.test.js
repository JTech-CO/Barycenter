import { describe, expect, it } from 'vitest';
import { NumericalError } from './errors.js';
import { computeAccelerations, computePotentialEnergy } from './forces.js';
import { createRuntimeState } from './state.js';

describe('direct gravity oracle', () => {
  it('matches the analytic two-body acceleration and Newton pair symmetry', () => {
    const state = createRuntimeState([
      {
        id: 1,
        name: 'Left',
        kind: 'massive',
        mass: 2,
        position: [-0.5, 0, 0],
        velocity: [0, 0, 0],
      },
      {
        id: 2,
        name: 'Right',
        kind: 'massive',
        mass: 3,
        position: [0.5, 0, 0],
        velocity: [0, 0, 0],
      },
    ]);

    const acceleration = computeAccelerations(state, 0, 1);

    expect([...acceleration]).toEqual([3, 0, 0, -2, 0, 0]);
    expect(2 * acceleration[0] + 3 * acceleration[3]).toBe(0);
  });

  it('lets tracers receive gravity without sourcing it', () => {
    const state = createRuntimeState([
      {
        id: 1,
        name: 'Primary',
        kind: 'massive',
        mass: 2,
        position: [0, 0, 0],
        velocity: [0, 0, 0],
      },
      {
        id: 2,
        name: 'Probe',
        kind: 'tracer',
        mass: 0,
        position: [2, 0, 0],
        velocity: [0, 0, 0],
      },
    ]);

    expect([...computeAccelerations(state, 0, 1)]).toEqual([
      0,
      0,
      0,
      -0.5,
      0,
      0,
    ]);
    expect(computePotentialEnergy(state, 0, 1)).toBe(0);
  });

  it('uses a potential whose numerical gradient matches the softened force', () => {
    const softening = 0.2;
    const separation = 1.7;
    const delta = 1e-6;
    /** @param {number} distance */
    const makeState = (distance) =>
      createRuntimeState([
        {
          id: 1,
          name: 'A',
          kind: 'massive',
          mass: 2,
          position: [0, 0, 0],
          velocity: [0, 0, 0],
        },
        {
          id: 2,
          name: 'B',
          kind: 'massive',
          mass: 3,
          position: [distance, 0, 0],
          velocity: [0, 0, 0],
        },
      ]);
    const state = makeState(separation);
    const acceleration = computeAccelerations(state, softening, 1);
    const derivative =
      (computePotentialEnergy(makeState(separation + delta), softening, 1) -
        computePotentialEnergy(makeState(separation - delta), softening, 1)) /
      (2 * delta);

    expect(acceleration[3]).toBeCloseTo(-derivative / 3, 9);
  });

  it('handles softened overlap and rejects singular unsoftened overlap', () => {
    const state = createRuntimeState([
      {
        id: 1,
        name: 'A',
        kind: 'massive',
        mass: 1,
        position: [0, 0, 0],
        velocity: [0, 0, 0],
      },
      {
        id: 2,
        name: 'B',
        kind: 'massive',
        mass: 1,
        position: [0, 0, 0],
        velocity: [0, 0, 0],
      },
    ]);

    expect([...computeAccelerations(state, 0.1, 1)]).toEqual([
      0, 0, 0, 0, 0, 0,
    ]);
    expect(computePotentialEnergy(state, 0.1, 1)).toBe(-10);
    expect(() => computeAccelerations(state, 0, 1)).toThrow(NumericalError);
    expect(() => computePotentialEnergy(state, 0, 1)).toThrow(NumericalError);
  });
});
