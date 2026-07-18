import { describe, expect, it } from 'vitest';
import {
  ASTRONOMICAL_UNIT_KILOMETERS,
  JULIAN_YEAR_DAYS,
  JULIAN_YEAR_SECONDS,
  auPerYearToKilometersPerSecond,
  auToKilometers,
  daysToYears,
  kilometersPerSecondToAuPerYear,
  kilometersToAu,
  yearsToDays,
} from './units.js';

describe('normalized unit conversion', () => {
  it('converts the conventional astronomical unit and Julian year', () => {
    expect(kilometersToAu(ASTRONOMICAL_UNIT_KILOMETERS)).toBe(1);
    expect(auToKilometers(1)).toBe(ASTRONOMICAL_UNIT_KILOMETERS);
    expect(daysToYears(JULIAN_YEAR_DAYS)).toBe(1);
    expect(yearsToDays(1)).toBe(JULIAN_YEAR_DAYS);
    expect(JULIAN_YEAR_SECONDS).toBe(365.25 * 24 * 60 * 60);
  });

  it('round-trips velocity between km/s and AU/yr', () => {
    const kilometersPerSecond = 29.78;
    const normalized = kilometersPerSecondToAuPerYear(kilometersPerSecond);

    expect(auPerYearToKilometersPerSecond(normalized)).toBeCloseTo(
      kilometersPerSecond,
      13,
    );
  });

  it('rejects non-finite values instead of leaking NaN into core state', () => {
    expect(() => kilometersToAu(Number.NaN)).toThrow(RangeError);
    expect(() => yearsToDays(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
