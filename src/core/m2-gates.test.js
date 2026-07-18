import { describe, expect, it } from 'vitest';
import { computeConservedQuantities } from './diagnostics.js';
import { computeAccelerations } from './forces.js';
import { leapfrogStep } from './integrators.js';
import { createRuntimeState } from './state.js';
import { createWorld } from './world.js';

/** @returns {import('./state.js').Body[]} */
function circularBinaryBodies() {
  const speed = Math.sqrt(0.5);
  return [
    {
      id: 1,
      name: 'A',
      kind: 'massive',
      mass: 1,
      position: [-0.5, 0, 0],
      velocity: [0, -speed, 0],
    },
    {
      id: 2,
      name: 'B',
      kind: 'massive',
      mass: 1,
      position: [0.5, 0, 0],
      velocity: [0, speed, 0],
    },
  ];
}

/** @param {number} dt @param {number} duration */
function circularPositionError(dt, duration) {
  const state = createRuntimeState(circularBinaryBodies());
  const steps = Math.round(duration / dt);
  for (let step = 0; step < steps; step += 1) {
    leapfrogStep(state, dt, 0, 1);
  }
  const angle = Math.sqrt(2) * duration;
  const expected = [0.5 * Math.cos(angle), 0.5 * Math.sin(angle)];
  return Math.hypot(
    state.positions[3] - expected[0],
    state.positions[4] - expected[1],
  );
}

describe('M2 numerical gates', () => {
  it('shows second-order convergence when leapfrog dt is halved', () => {
    const coarseError = circularPositionError(0.02, 0.5);
    const fineError = circularPositionError(0.01, 0.5);

    expect(fineError).toBeLessThan(coarseError / 3.5);
  });

  it('keeps an extreme mass-ratio force evaluation finite and symmetric', () => {
    const state = createRuntimeState([
      {
        id: 1,
        name: 'Heavy',
        kind: 'massive',
        mass: 1e12,
        position: [0, 0, 0],
        velocity: [0, 0, 0],
      },
      {
        id: 2,
        name: 'Light',
        kind: 'massive',
        mass: 1e-12,
        position: [1, 0, 0],
        velocity: [0, 0, 0],
      },
    ]);
    const acceleration = computeAccelerations(state, 0, 1);

    expect([...acceleration].every(Number.isFinite)).toBe(true);
    expect(acceleration[0]).toBe(1e-12);
    expect(acceleration[3]).toBe(-1e12);
    expect(
      state.masses[0] * acceleration[0] +
        state.masses[1] * acceleration[3],
    ).toBe(0);
  });

  it('excludes tracers from massive dynamics and conserved quantities', () => {
    const massiveBodies = circularBinaryBodies();
    const tracer = {
      id: 3,
      name: 'Probe',
      kind: /** @type {const} */ ('tracer'),
      mass: 0,
      position: [3, 0, 0],
      velocity: [0, 1, 0],
    };
    const massiveState = createRuntimeState(massiveBodies);
    const tracedState = createRuntimeState([...massiveBodies, tracer]);
    const massiveAcceleration = computeAccelerations(massiveState, 0, 1);
    const tracedAcceleration = computeAccelerations(tracedState, 0, 1);
    const massiveDiagnostics = computeConservedQuantities(massiveState, 0, 1);
    const tracedDiagnostics = computeConservedQuantities(tracedState, 0, 1);

    expect([...tracedAcceleration.slice(0, 6)]).toEqual([
      ...massiveAcceleration,
    ]);
    expect(tracedDiagnostics.energy).toBe(massiveDiagnostics.energy);
    expect([...tracedDiagnostics.momentum]).toEqual([
      ...massiveDiagnostics.momentum,
    ]);
    expect([...tracedDiagnostics.angularMomentum]).toEqual([
      ...massiveDiagnostics.angularMomentum,
    ]);
    expect(Math.abs(tracedAcceleration[6])).toBeGreaterThan(0);
  });

  it('rejects invalid world configuration before the first step', () => {
    expect(() => createWorld(circularBinaryBodies(), { dt: 0 })).toThrow(
      /dt/,
    );
    expect(() =>
      createWorld(circularBinaryBodies(), { substeps: 1.5 }),
    ).toThrow(/substeps/);
    expect(() =>
      createWorld(circularBinaryBodies(), { softening: -1 }),
    ).toThrow(/softening/);
  });
});
