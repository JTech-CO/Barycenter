import { describe, expect, it } from 'vitest';
import { INTEGRATORS } from './integrators.js';
import {
  createWorld,
  resetWorld,
  snapshotWorld,
  stepWorld,
} from './world.js';

/** @returns {import('./state.js').Body[]} */
function binaryBodies() {
  return [
    {
      id: 1,
      name: 'A',
      kind: 'massive',
      mass: 1,
      position: [-0.5, 0, 0],
      velocity: [0, -0.5, 0],
    },
    {
      id: 2,
      name: 'B',
      kind: 'massive',
      mass: 1,
      position: [0.5, 0, 0],
      velocity: [0, 0.5, 0],
    },
  ];
}

describe('world lifecycle', () => {
  it('produces byte-identical state for repeated deterministic runs', () => {
    const config = {
      integrator: INTEGRATORS.YOSHIDA4,
      dt: 0.001,
      substeps: 2,
      softening: 1e-6,
      G: 1,
    };
    const worlds = Array.from({ length: 3 }, () =>
      createWorld(binaryBodies(), config),
    );

    for (const world of worlds) expect(stepWorld(world, 100).ok).toBe(true);

    expect([...worlds[1].state.positions]).toEqual([
      ...worlds[0].state.positions,
    ]);
    expect([...worlds[2].state.positions]).toEqual([
      ...worlds[0].state.positions,
    ]);
    expect([...worlds[1].state.velocities]).toEqual([
      ...worlds[0].state.velocities,
    ]);
    expect([...worlds[2].state.velocities]).toEqual([
      ...worlds[0].state.velocities,
    ]);
  });

  it('rolls back a failed outer step and enters safe-stop state', () => {
    const world = createWorld(binaryBodies(), {
      dt: Number.MAX_VALUE,
      softening: 0,
      G: 1,
    });
    const before = snapshotWorld(world);

    const result = stepWorld(world);

    expect(result.ok).toBe(false);
    expect(world.status).toBe('error');
    expect(world.lastError).not.toBeNull();
    expect(world.time).toBe(before.time);
    expect(world.step).toBe(before.step);
    expect(snapshotWorld(world).bodies).toEqual(before.bodies);
  });

  it('keeps coincident bodies finite when softening is enabled', () => {
    const bodies = binaryBodies();
    bodies[0].position = [0, 0, 0];
    bodies[1].position = [0, 0, 0];
    const world = createWorld(bodies, {
      dt: 0.001,
      softening: 0.1,
      G: 1,
    });

    expect(stepWorld(world).ok).toBe(true);
    expect([...world.state.positions].every(Number.isFinite)).toBe(true);
    expect([...world.state.velocities].every(Number.isFinite)).toBe(true);
  });

  it('resets phase space, clocks, errors, and diagnostics', () => {
    const world = createWorld(binaryBodies(), {
      dt: 0.001,
      softening: 1e-6,
      G: 1,
    });
    const initial = snapshotWorld(world);
    stepWorld(world, 10);

    resetWorld(world);

    expect(snapshotWorld(world)).toEqual(initial);
  });
});
