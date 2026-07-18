/** Normalized gravitational constant for AU, yr, and solar-mass units. */
export const ASTRONOMICAL_UNIT_KILOMETERS = 149_597_870.7;
export const JULIAN_YEAR_DAYS = 365.25;
export const JULIAN_YEAR_SECONDS = 31_557_600;

export const GRAVITATIONAL_CONSTANT = 4 * Math.PI ** 2;

export const UNITS = Object.freeze({
  distance: 'AU',
  time: 'yr',
  mass: 'M☉',
  velocity: 'AU/yr',
});

/** @param {number} value @param {string} label */
function assertFiniteUnitValue(value, label) {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite.`);
  }
}

/** @param {number} kilometers */
export function kilometersToAu(kilometers) {
  assertFiniteUnitValue(kilometers, 'Distance');
  return kilometers / ASTRONOMICAL_UNIT_KILOMETERS;
}

/** @param {number} au */
export function auToKilometers(au) {
  assertFiniteUnitValue(au, 'Distance');
  return au * ASTRONOMICAL_UNIT_KILOMETERS;
}

/** @param {number} days */
export function daysToYears(days) {
  assertFiniteUnitValue(days, 'Time');
  return days / JULIAN_YEAR_DAYS;
}

/** @param {number} years */
export function yearsToDays(years) {
  assertFiniteUnitValue(years, 'Time');
  return years * JULIAN_YEAR_DAYS;
}

/** @param {number} kilometersPerSecond */
export function kilometersPerSecondToAuPerYear(kilometersPerSecond) {
  assertFiniteUnitValue(kilometersPerSecond, 'Velocity');
  return (
    (kilometersPerSecond * JULIAN_YEAR_SECONDS) /
    ASTRONOMICAL_UNIT_KILOMETERS
  );
}

/** @param {number} auPerYear */
export function auPerYearToKilometersPerSecond(auPerYear) {
  assertFiniteUnitValue(auPerYear, 'Velocity');
  return (
    (auPerYear * ASTRONOMICAL_UNIT_KILOMETERS) /
    JULIAN_YEAR_SECONDS
  );
}
