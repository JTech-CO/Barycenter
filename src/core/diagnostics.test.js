import { describe, expect, it } from 'vitest';
import {
  computeConservedQuantities,
  createDiagnosticReference,
  measureDiagnostics,
} from './diagnostics.js';
import { cloneRuntimeState, createRuntimeState } from './state.js';

describe('conservation diagnostics', () => {
  it('matches analytic energy, momentum, angular momentum, and barycenter', () => {
    const state = createRuntimeState([
      {
        id: 1,
        name: 'A',
        kind: 'massive',
        mass: 2,
        position: [-1, 0, 0],
        velocity: [0, 1, 0],
      },
      {
        id: 2,
        name: 'B',
        kind: 'massive',
        mass: 1,
        position: [2, 0, 0],
        velocity: [0, -2, 0],
      },
    ]);
    const quantities = computeConservedQuantities(state, 0, 1);

    expect(quantities.kineticEnergy).toBe(3);
    expect(quantities.potentialEnergy).toBeCloseTo(-2 / 3, 14);
    expect(quantities.energy).toBeCloseTo(7 / 3, 14);
    expect([...quantities.momentum]).toEqual([0, 0, 0]);
    expect([...quantities.angularMomentum]).toEqual([0, 0, -6]);
    expect([...quantities.centerOfMass]).toEqual([0, 0, 0]);
    expect(quantities.totalMass).toBe(3);
  });

  it('keeps zero-angular-momentum normalization finite', () => {
    const state = createRuntimeState([
      {
        id: 1,
        name: 'A',
        kind: 'massive',
        mass: 1,
        position: [-0.5, 0, 0],
        velocity: [1, 0, 0],
      },
      {
        id: 2,
        name: 'B',
        kind: 'massive',
        mass: 1,
        position: [0.5, 0, 0],
        velocity: [-1, 0, 0],
      },
    ]);
    const reference = createDiagnosticReference(state, 0.1, 1);
    const diagnostics = measureDiagnostics(state, reference, 0, 0.1, 1);

    expect(diagnostics.angularMomentumError).toBe(0);
    expect(Number.isFinite(diagnostics.angularMomentumError)).toBe(true);
  });

  it('measures barycenter drift against uniform center-of-mass motion', () => {
    const state = createRuntimeState([
      {
        id: 1,
        name: 'A',
        kind: 'massive',
        mass: 1,
        position: [-1, 0, 0],
        velocity: [1, 0, 0],
      },
      {
        id: 2,
        name: 'B',
        kind: 'massive',
        mass: 1,
        position: [1, 0, 0],
        velocity: [1, 0, 0],
      },
    ]);
    const reference = createDiagnosticReference(state, 0.1, 1);
    const translated = cloneRuntimeState(state);
    for (let body = 0; body < translated.count; body += 1) {
      translated.positions[body * 3] += 2;
    }
    const diagnostics = measureDiagnostics(
      translated,
      reference,
      2,
      0.1,
      1,
    );

    expect(diagnostics.centerOfMassDrift).toBeLessThan(1e-15);
  });

  it('marks externally fixed worlds as constrained', () => {
    const state = createRuntimeState([
      {
        id: 1,
        name: 'Fixed',
        kind: 'massive',
        mass: 1,
        position: [0, 0, 0],
        velocity: [0, 0, 0],
        fixed: true,
      },
    ]);

    expect(computeConservedQuantities(state, 0, 1).constrained).toBe(true);
  });
});
