import { describe, expect, it } from 'vitest';
import { computeConservedQuantities } from '../core/diagnostics.js';
import { createRuntimeState } from '../core/state.js';
import { GRAVITATIONAL_CONSTANT } from '../core/units.js';
import {
  REFERENCE_FIXTURE_IDS,
  createFigureEightFixture,
  createReferenceFixtures,
  getReferenceFixture,
} from '../scenarios/reference.js';
import { runConservationExperiment } from './physics.js';

describe('reference fixture catalog', () => {
  it('defines all six versioned M3 scenarios with provenance and units', () => {
    const fixtures = createReferenceFixtures();

    expect(fixtures).toHaveLength(6);
    expect(new Set(fixtures.map((fixture) => fixture.id)).size).toBe(6);
    for (const fixture of fixtures) {
      expect(fixture.source.length).toBeGreaterThan(10);
      expect(fixture.sourceUrl.length).toBeGreaterThan(10);
      expect(fixture.unitConversion).toContain('AU');
      expect(fixture.bodies.length).toBeGreaterThanOrEqual(2);
      expect(fixture.config.G).toBe(GRAVITATIONAL_CONSTANT);
      expect(fixture.config.dt).toBeGreaterThan(0);
      expect(Object.keys(fixture.tolerances).length).toBeGreaterThan(0);
    }
  });

  it('returns fresh fixture state and rejects unknown identifiers', () => {
    const first = getReferenceFixture(REFERENCE_FIXTURE_IDS.CIRCULAR_BINARY);
    const second = getReferenceFixture(REFERENCE_FIXTURE_IDS.CIRCULAR_BINARY);
    first.bodies[0].mass = 99;

    expect(second.bodies[0].mass).not.toBe(99);
    expect(() => getReferenceFixture('not-a-fixture')).toThrow(/Unknown/);
  });

  it('scales the published G=1 figure-8 conditions to G=4π²', () => {
    const fixture = createFigureEightFixture();
    const velocityScale = 2 * Math.PI;

    expect(fixture.referencePeriod).toBeCloseTo(
      6.32591398 / velocityScale,
      14,
    );
    expect(fixture.bodies[0].velocity[0]).toBeCloseTo(
      0.466203685 * velocityScale,
      14,
    );
    const quantities = computeConservedQuantities(
      createRuntimeState(fixture.bodies),
      0,
      GRAVITATIONAL_CONSTANT,
    );
    expect(Math.hypot(...quantities.momentum)).toBeLessThan(1e-14);
    expect(Math.hypot(...quantities.angularMomentum)).toBeLessThan(1e-14);
  });

  it('keeps repository-authored edge fixtures finite over their safety windows', () => {
    const lowMomentum = getReferenceFixture(
      REFERENCE_FIXTURE_IDS.LOW_MOMENTUM_SYMMETRY,
    );
    const closeEncounter = getReferenceFixture(
      REFERENCE_FIXTURE_IDS.SOFTENED_CLOSE_ENCOUNTER,
    );
    const lowResult = runConservationExperiment(lowMomentum, {
      duration: lowMomentum.config.dt * 500,
      sampleEvery: 10,
    });
    const closeResult = runConservationExperiment(closeEncounter, {
      duration: closeEncounter.config.dt * 100,
      sampleEvery: 5,
    });

    expect(lowResult.finite).toBe(true);
    expect(closeResult.finite).toBe(true);
    expect(lowResult.maximumCenterOfMassDrift).toBeLessThan(
      lowMomentum.tolerances.centerOfMass,
    );
    expect(closeResult.maximumCenterOfMassDrift).toBeLessThan(
      closeEncounter.tolerances.centerOfMass,
    );
  });

  it.each(createReferenceFixtures())(
    '$id keeps closed-system angular momentum and expected COM bounded',
    (fixture) => {
      const stepsPerPeriod =
        fixture.referencePeriod == null
          ? null
          : Math.round(fixture.referencePeriod / fixture.config.dt);
      const result = runConservationExperiment(fixture, {
        ...(stepsPerPeriod == null
          ? { duration: fixture.config.dt * 100 }
          : { periods: 1, stepsPerPeriod }),
        sampleEvery:
          stepsPerPeriod == null
            ? 5
            : Math.max(1, Math.ceil(stepsPerPeriod / 16)),
      });

      expect(result.finite).toBe(true);
      expect(result.maximumAngularMomentumError).toBeLessThanOrEqual(
        fixture.tolerances.angularMomentum,
      );
      expect(result.maximumCenterOfMassDrift).toBeLessThanOrEqual(
        fixture.tolerances.centerOfMass,
      );
    },
  );
});
