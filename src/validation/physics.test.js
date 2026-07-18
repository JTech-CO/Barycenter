import { describe, expect, it } from 'vitest';
import { INTEGRATORS } from '../core/integrators.js';
import {
  createCircularBinaryFixture,
  createEccentricBinaryFixture,
  createPlanetaryMassRatioFixture,
} from '../scenarios/reference.js';
import {
  analyzeBinaryOrbit,
  runConservationExperiment,
  runConvergenceStudy,
} from './physics.js';

describe('fast physics validation', () => {
  it.each([
    ['circular', createCircularBinaryFixture(), 512],
    ['eccentric', createEccentricBinaryFixture(), 2048],
    ['mass-ratio', createPlanetaryMassRatioFixture(), 1024],
  ])('matches the %s analytic binary period and shape', (_label, fixture, steps) => {
    const result = analyzeBinaryOrbit(fixture, { stepsPerPeriod: steps });

    expect(result.periodRelativeError).toBeLessThanOrEqual(
      fixture.tolerances.periodRelative,
    );
    expect(result.semiMajorRelativeError).toBeLessThanOrEqual(
      fixture.tolerances.semiMajorRelative,
    );
    expect(result.eccentricityAbsoluteError).toBeLessThanOrEqual(
      fixture.tolerances.eccentricityAbsolute,
    );
  });

  it('observes the expected leapfrog and Yoshida4 convergence orders', () => {
    const fixture = createCircularBinaryFixture();
    const leapfrog = runConvergenceStudy(
      fixture,
      INTEGRATORS.LEAPFROG,
      [32, 64, 128],
    );
    const yoshida = runConvergenceStudy(
      fixture,
      INTEGRATORS.YOSHIDA4,
      [16, 32, 64],
    );

    for (const order of leapfrog.observedOrders) {
      expect(order).toBeGreaterThan(1.8);
      expect(order).toBeLessThan(2.2);
    }
    for (const order of yoshida.observedOrders) {
      expect(order).toBeGreaterThan(3.5);
      expect(order).toBeLessThan(4.5);
    }
  });

  it('keeps angular momentum and the moving COM path within scale limits', () => {
    const fixture = createCircularBinaryFixture();
    const result = runConservationExperiment(fixture, {
      periods: 20,
      stepsPerPeriod: 64,
      sampleEvery: 8,
      integrator: INTEGRATORS.LEAPFROG,
    });

    expect(result.maximumAngularMomentumError).toBeLessThan(
      fixture.tolerances.angularMomentum,
    );
    expect(result.maximumCenterOfMassDrift).toBeLessThan(
      fixture.tolerances.centerOfMass,
    );
    expect(result.finite).toBe(true);
  });
});
