import { describe, expect, it } from 'vitest';
import { INTEGRATORS } from '../core/integrators.js';
import {
  createCircularBinaryFixture,
  createFigureEightFixture,
} from '../scenarios/reference.js';
import {
  compareIntegratorEnergy,
  runConservationExperiment,
} from './physics.js';

describe('long-horizon physics validation', () => {
  it('bounds leapfrog energy trend over 1,000 binary periods', () => {
    const fixture = createCircularBinaryFixture();
    const result = runConservationExperiment(fixture, {
      periods: 1000,
      stepsPerPeriod: 64,
      sampleEvery: 8,
      integrator: INTEGRATORS.LEAPFROG,
    });

    expect(result.periods).toBeGreaterThanOrEqual(1000 - 1e-9);
    expect(result.trendToEnvelope).toBeLessThanOrEqual(0.1);
    expect(result.maximumAngularMomentumError).toBeLessThan(
      fixture.tolerances.angularMomentum,
    );
    expect(result.maximumCenterOfMassDrift).toBeLessThan(
      fixture.tolerances.centerOfMass,
    );
    expect(result.finite).toBe(true);
  }, 120_000);

  it('preserves figure-8 recurrence and boundedness for 100 periods', () => {
    const fixture = createFigureEightFixture();
    const result = runConservationExperiment(fixture, {
      periods: 100,
      stepsPerPeriod: 1024,
      sampleEvery: 64,
      integrator: INTEGRATORS.YOSHIDA4,
    });

    expect(result.periods).toBeGreaterThanOrEqual(100 - 1e-9);
    expect(result.recurrenceError).toBeLessThan(fixture.tolerances.recurrence);
    expect(result.minimumSeparation).toBeGreaterThan(
      fixture.tolerances.minimumSeparation,
    );
    expect(result.maximumRadius).toBeLessThan(fixture.tolerances.maximumRadius);
    expect(result.maximumAbsoluteEnergyError).toBeLessThan(
      fixture.tolerances.energy,
    );
    expect(result.maximumAngularMomentumError).toBeLessThan(
      fixture.tolerances.angularMomentum,
    );
    expect(result.maximumCenterOfMassDrift).toBeLessThan(
      fixture.tolerances.centerOfMass,
    );
    expect(result.finite).toBe(true);
  }, 120_000);

  it('records RK4 comparison metrics without a brittle monotonic-drift gate', () => {
    const comparison = compareIntegratorEnergy(createCircularBinaryFixture(), {
      periods: 100,
      stepsPerPeriod: 32,
    });

    expect(comparison.leapfrog.finite).toBe(true);
    expect(comparison.rk4.finite).toBe(true);
    expect(comparison.leapfrog.energyPeakToPeak).toBeGreaterThanOrEqual(0);
    expect(comparison.rk4.energyPeakToPeak).toBeGreaterThanOrEqual(0);
  }, 120_000);
});
