import { describe, expect, it } from 'vitest';
import { GRAVITATIONAL_CONSTANT, UNITS } from './units.js';
import {
  add,
  cross,
  dot,
  equalsWithin,
  magnitude,
  normalize,
  subtract,
  vec3,
} from './vec.js';

describe('normalized units', () => {
  it('uses the AU-year-solar-mass gravitational constant', () => {
    expect(GRAVITATIONAL_CONSTANT).toBeCloseTo(39.47841760435743, 14);
    expect(UNITS).toEqual({
      distance: 'AU',
      time: 'yr',
      mass: 'M☉',
      velocity: 'AU/yr',
    });
  });
});

describe('Vec3', () => {
  it('adds and subtracts without allocating the output', () => {
    const a = vec3(1, 2, 3);
    const b = vec3(4, -2, 0.5);
    const out = vec3();

    expect(add(out, a, b)).toBe(out);
    expect([...out]).toEqual([5, 0, 3.5]);
    expect([...subtract(out, a, b)]).toEqual([-3, 4, 2.5]);
  });

  it('computes dot and cross products', () => {
    const x = vec3(1, 0, 0);
    const y = vec3(0, 1, 0);
    const out = vec3();

    expect(dot(x, y)).toBe(0);
    expect([...cross(out, x, y)]).toEqual([0, 0, 1]);
  });

  it('normalizes finite nonzero vectors', () => {
    const out = vec3();
    normalize(out, vec3(3, 4, 0));

    expect(magnitude(out)).toBeCloseTo(1, 14);
    expect(equalsWithin(out, vec3(0.6, 0.8, 0), 1e-15)).toBe(true);
  });

  it('rejects zero-length normalization', () => {
    expect(() => normalize(vec3(), vec3())).toThrow(RangeError);
  });
});
