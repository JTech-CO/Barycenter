import { describe, expect, it } from 'vitest';
import {
  barycentricToInertial,
  computeBarycentricFrame,
  createPrimaryPairFrame,
  createRotatingFrame,
  inertialToBarycentric,
  inertialToRotating,
  rotatingToInertial,
} from './frames.js';
import { createRuntimeState } from './state.js';

describe('reference frames', () => {
  it('computes a massive-only barycenter and reverses translation', () => {
    const state = createRuntimeState([
      {
        id: 1,
        name: 'A',
        kind: 'massive',
        mass: 2,
        position: [-1, 2, 0],
        velocity: [3, 0, 1],
      },
      {
        id: 2,
        name: 'B',
        kind: 'massive',
        mass: 1,
        position: [2, -1, 0],
        velocity: [0, 3, -2],
      },
      {
        id: 3,
        name: 'Tracer',
        kind: 'tracer',
        mass: 0,
        position: [100, 100, 100],
        velocity: [100, 100, 100],
      },
    ]);
    const frame = computeBarycentricFrame(state);
    const point = inertialToBarycentric([4, 5, 6], [7, 8, 9], frame);
    const restored = barycentricToInertial(
      point.position,
      point.velocity,
      frame,
    );

    expect([...frame.originPosition]).toEqual([0, 1, 0]);
    expect([...frame.originVelocity]).toEqual([2, 1, 0]);
    expect([...restored.position]).toEqual([4, 5, 6]);
    expect([...restored.velocity]).toEqual([7, 8, 9]);
  });

  it('round-trips 3D rotating position and velocity below 1e-12', () => {
    const frame = createRotatingFrame({
      originPosition: [1, -2, 0.5],
      originVelocity: [0.2, -0.1, 0.05],
      epochTime: 0.4,
      epochAngle: 0.7,
      angularVelocity: 1.3,
    });
    const position = new Float64Array([3.2, -1.1, 4.5]);
    const velocity = new Float64Array([-0.7, 2.4, -0.3]);
    const rotating = inertialToRotating(position, velocity, 3.7, frame);
    const restored = rotatingToInertial(
      rotating.position,
      rotating.velocity,
      3.7,
      frame,
    );

    for (let axis = 0; axis < 3; axis += 1) {
      expect(Math.abs(restored.position[axis] - position[axis])).toBeLessThan(
        1e-12,
      );
      expect(Math.abs(restored.velocity[axis] - velocity[axis])).toBeLessThan(
        1e-12,
      );
    }
  });

  it('infers a primary-pair frame that freezes a circular binary', () => {
    const frame = createPrimaryPairFrame(
      [-0.1, 0, 0],
      [0, -0.2, 0],
      0.9,
      [0.9, 0, 0],
      [0, 1.8, 0],
      0.1,
    );
    const primary = inertialToRotating(
      [-0.1, 0, 0],
      [0, -0.2, 0],
      0,
      frame,
    );
    const secondary = inertialToRotating(
      [0.9, 0, 0],
      [0, 1.8, 0],
      0,
      frame,
    );

    expect(frame.angularVelocity).toBeCloseTo(2, 14);
    expect([...primary.position]).toEqual([-0.1, 0, 0]);
    expect([...secondary.position]).toEqual([0.9, 0, 0]);
    expect(Math.hypot(...primary.velocity)).toBeLessThan(1e-15);
    expect(Math.hypot(...secondary.velocity)).toBeLessThan(1e-15);
  });
});
