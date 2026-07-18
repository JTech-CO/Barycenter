import { describe, expect, it } from 'vitest';
import { ValidationError } from './errors.js';
import {
  elementsToState,
  normalizeAngle,
  solveEccentricAnomaly,
  stateToElements,
} from './kepler.js';

/** @param {number} left @param {number} right */
function angleDistance(left, right) {
  return Math.abs(normalizeAngle(left - right + Math.PI) - Math.PI);
}

describe('Kepler conversion', () => {
  it('round-trips a general inclined elliptic orbit', () => {
    const elements = {
      a: 2.3,
      e: 0.4,
      i: 0.5,
      Omega: 1.1,
      omega: 0.7,
      anomaly: { type: /** @type {const} */ ('true'), value: 2 },
      primaryId: 42,
    };
    const state = elementsToState(elements, 4 * Math.PI ** 2);
    const recovered = stateToElements(
      state.position,
      state.velocity,
      4 * Math.PI ** 2,
      42,
    );

    expect(recovered.a).toBeCloseTo(elements.a, 11);
    expect(recovered.e).toBeCloseTo(elements.e, 11);
    expect(angleDistance(recovered.i, elements.i)).toBeLessThan(1e-11);
    expect(angleDistance(recovered.Omega, elements.Omega)).toBeLessThan(1e-11);
    expect(angleDistance(recovered.omega, elements.omega)).toBeLessThan(1e-11);
    expect(
      angleDistance(recovered.anomaly.value, elements.anomaly.value),
    ).toBeLessThan(1e-11);
    expect(recovered.primaryId).toBe(42);
  });

  it('solves high-eccentricity mean anomaly with a small residual', () => {
    const meanAnomaly = 0.07;
    const eccentricity = 0.999;
    const eccentricAnomaly = solveEccentricAnomaly(
      meanAnomaly,
      eccentricity,
    );
    const residual =
      eccentricAnomaly -
      eccentricity * Math.sin(eccentricAnomaly) -
      normalizeAngle(meanAnomaly);

    expect(Math.abs(residual)).toBeLessThan(1e-13);
  });

  it('requires explicit elliptic anomaly semantics', () => {
    expect(() =>
      elementsToState(
        {
          a: 1,
          e: 1,
          i: 0,
          Omega: 0,
          omega: 0,
          anomaly: { type: 'true', value: 0 },
        },
        1,
      ),
    ).toThrow(ValidationError);
    expect(() => solveEccentricAnomaly(0, 1)).toThrow(ValidationError);
  });
});
