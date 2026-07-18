import { describe, expect, it } from 'vitest';
import {
  LagrangePointSolveError,
  canonicalToPhysicalRotating,
  createCr3bpNormalization,
  effectivePotential,
  effectivePotentialGradient,
  jacobiConstant,
  physicalRotatingToCanonical,
  sampleZeroVelocityGrid,
  solveCollinearLagrangePoint,
  solveLagrangePoints,
} from './cr3bp.js';

describe('canonical CR3BP', () => {
  it('round-trips the physical AU/yr boundary', () => {
    const normalization = createCr3bpNormalization({
      primaryMass: 2,
      secondaryMass: 0.2,
      separation: 3,
      gravitationalConstant: 1,
    });
    const canonicalPosition = new Float64Array([0.3, -0.4, 0.2]);
    const canonicalVelocity = new Float64Array([0.1, 0.7, -0.05]);
    const physical = canonicalToPhysicalRotating(
      canonicalPosition,
      canonicalVelocity,
      normalization,
    );
    const restored = physicalRotatingToCanonical(
      physical.position,
      physical.velocity,
      normalization,
    );

    expect(normalization.mu).toBeCloseTo(1 / 11, 15);
    for (let axis = 0; axis < 3; axis += 1) {
      expect(restored.position[axis]).toBeCloseTo(canonicalPosition[axis], 14);
      expect(restored.velocity[axis]).toBeCloseTo(canonicalVelocity[axis], 14);
    }
  });

  it('matches the analytic effective-potential gradient by finite difference', () => {
    const mu = 0.01;
    const point = [0.2, 0.3, 0.1];
    const delta = 1e-6;
    const gradient = effectivePotentialGradient(mu, point[0], point[1], point[2]);

    for (let axis = 0; axis < 3; axis += 1) {
      const plus = [...point];
      const minus = [...point];
      plus[axis] += delta;
      minus[axis] -= delta;
      const numerical =
        (effectivePotential(mu, plus[0], plus[1], plus[2]) -
          effectivePotential(mu, minus[0], minus[1], minus[2])) /
        (2 * delta);
      expect(gradient[axis]).toBeCloseTo(numerical, 8);
    }
  });

  it('solves L1-L5 with small potential-gradient residuals', () => {
    const mu = 0.0121505856;
    const points = solveLagrangePoints(mu);

    expect([...points.L4.position]).toEqual([
      0.5 - mu,
      Math.sqrt(3) / 2,
      0,
    ]);
    expect([...points.L5.position]).toEqual([
      0.5 - mu,
      -Math.sqrt(3) / 2,
      0,
    ]);
    for (const point of Object.values(points)) {
      const gradient = effectivePotentialGradient(
        mu,
        point.position[0],
        point.position[1],
        point.position[2],
      );
      expect(Math.hypot(...gradient)).toBeLessThan(1e-11);
      expect(point.residual).toBeLessThan(1e-11);
    }
  });

  it('preserves bracket and reason when a collinear solve cannot start', () => {
    try {
      solveCollinearLagrangePoint(0.01, 'L1', { bracket: [2, 3] });
      throw new Error('Expected bracket failure.');
    } catch (error) {
      expect(error).toBeInstanceOf(LagrangePointSolveError);
      if (!(error instanceof LagrangePointSolveError)) return;
      expect(error.details).toMatchObject({
        label: 'L1',
        reason: 'invalid-bracket',
        lower: 2,
        upper: 3,
        iterations: 0,
      });
    }
  });

  it('samples finite zero-velocity data independently of solver resolution', () => {
    const mu = 0.01;
    const l4 = solveLagrangePoints(mu).L4.position;
    const jacobi = jacobiConstant(mu, l4, [0, 0, 0]);
    const coarse = sampleZeroVelocityGrid(mu, jacobi, {
      xMin: -1.5,
      xMax: 1.5,
      yMin: -1.2,
      yMax: 1.2,
      width: 41,
      height: 33,
    });
    const fine = sampleZeroVelocityGrid(mu, jacobi, {
      xMin: -2,
      xMax: 2,
      yMin: -1.5,
      yMax: 1.5,
      width: 82,
      height: 66,
    });

    expect([...coarse.values].every(Number.isFinite)).toBe(true);
    expect([...fine.values].every(Number.isFinite)).toBe(true);
    expect(coarse.minimum).toBeLessThan(coarse.maximum);
    expect(fine.minimum).toBeLessThan(fine.maximum);
    expect([...solveLagrangePoints(mu).L4.position]).toEqual([...l4]);
  });
});
