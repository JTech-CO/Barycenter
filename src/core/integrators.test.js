import { describe, expect, it } from 'vitest';
import {
  INTEGRATORS,
  integrateStep,
  leapfrogStep,
} from './integrators.js';
import {
  assertFiniteState,
  cloneRuntimeState,
  createRuntimeState,
} from './state.js';

/** @returns {import('./state.js').RuntimeState} */
function binaryState() {
  return createRuntimeState([
    {
      id: 1,
      name: 'A',
      kind: 'massive',
      mass: 1,
      position: [-0.5, 0, 0],
      velocity: [0, -0.5, 0.1],
    },
    {
      id: 2,
      name: 'B',
      kind: 'massive',
      mass: 1,
      position: [0.5, 0, 0],
      velocity: [0, 0.5, -0.1],
    },
  ]);
}

describe('integrators', () => {
  it('makes leapfrog time-reversible to roundoff', () => {
    const state = binaryState();
    const initial = cloneRuntimeState(state);

    leapfrogStep(state, 0.001, 0, 1);
    leapfrogStep(state, -0.001, 0, 1);

    for (let index = 0; index < state.positions.length; index += 1) {
      expect(state.positions[index]).toBeCloseTo(initial.positions[index], 13);
      expect(state.velocities[index]).toBeCloseTo(initial.velocities[index], 13);
    }
  });

  it.each(Object.values(INTEGRATORS))(
    '%s remains finite and leaves fixed bodies unchanged',
    (integrator) => {
      const state = binaryState();
      state.fixed[0] = 1;
      const fixedPosition = state.positions.slice(0, 3);
      const fixedVelocity = state.velocities.slice(0, 3);

      integrateStep(state, integrator, 0.001, 1e-6, 1);

      expect([...state.positions.slice(0, 3)]).toEqual([...fixedPosition]);
      expect([...state.velocities.slice(0, 3)]).toEqual([...fixedVelocity]);
      expect(() => assertFiniteState(state)).not.toThrow();
    },
  );
});
