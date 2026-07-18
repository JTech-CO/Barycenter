import LZString from 'lz-string';
import { ValidationError } from '../core/errors.js';
import {
  createRuntimeState,
  runtimeStateToBodies,
} from '../core/state.js';
import { GRAVITATIONAL_CONSTANT } from '../core/units.js';
import { normalizeSimConfig } from '../core/world.js';

/** @typedef {import('../core/state.js').Body} Body */

/**
 * @typedef {object} Scenario
 * @property {1} version
 * @property {string} id
 * @property {string} title
 * @property {Body[]} bodies
 * @property {import('../core/world.js').SimConfig & {timeScale: number, rendering: {trailLength: number, showVelocity: boolean, showContours: boolean, showRotatingFrame: boolean}}} config
 * @property {{type: 'inertial' | 'barycentric' | 'rotating', refA: number | null, refB: number | null}} frame
 */

export const SCENARIO_VERSION = 1;
export const SCENARIO_HASH_PREFIX = '#scenario=1.';
export const MAX_SCENARIO_BODIES = 128;
export const MAX_SCENARIO_SUBSTEPS = 256;
export const MIN_SCENARIO_DT = 1e-9;
export const MAX_SCENARIO_DT = 100;
const MAX_SCENARIO_MAGNITUDE = 1e12;
const MAX_SCENARIO_SOFTENING = 1e6;
export const MAX_SCENARIO_JSON_LENGTH = 262_144;
export const MAX_SCENARIO_HASH_LENGTH = 32_768;

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param {unknown} value @param {string} label @param {number} maximumLength */
function validateText(value, label, maximumLength) {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > maximumLength
  ) {
    throw new ValidationError(
      `${label} must be non-empty and at most ${maximumLength} characters.`,
    );
  }
  return value.trim();
}

/** @param {unknown} raw @returns {Scenario} */
export function validateScenario(raw) {
  if (!isRecord(raw)) {
    throw new ValidationError('Scenario payload must be an object.');
  }
  if (raw.version !== SCENARIO_VERSION) {
    throw new ValidationError(`Unsupported scenario version: ${String(raw.version)}`);
  }
  const id = validateText(raw.id, 'Scenario id', 64);
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(id)) {
    throw new ValidationError('Scenario id may contain letters, numbers, and hyphens.');
  }
  const title = validateText(raw.title, 'Scenario title', 80);
  if (!Array.isArray(raw.bodies) || raw.bodies.length > MAX_SCENARIO_BODIES) {
    throw new ValidationError(
      `Scenario bodies must be an array of at most ${MAX_SCENARIO_BODIES}.`,
    );
  }
  const state = createRuntimeState(/** @type {Body[]} */ (raw.bodies));
  const bodies = runtimeStateToBodies(state).map((body) => {
    const name = validateText(body.name, 'Body name', 80);
    const components = [
      ...Array.from(body.position),
      ...Array.from(body.velocity),
    ];
    if (
      body.mass > MAX_SCENARIO_MAGNITUDE ||
      (body.radius ?? 1) > MAX_SCENARIO_MAGNITUDE ||
      components.some((value) => Math.abs(value) > MAX_SCENARIO_MAGNITUDE)
    ) {
      throw new ValidationError(
        'Body mass, radius, position, or velocity exceeds the shared-scenario safety range.',
      );
    }
    return {
      ...body,
      name,
      position: Array.from(body.position, (value) =>
        Object.is(value, -0) ? 0 : value),
      velocity: Array.from(body.velocity, (value) =>
        Object.is(value, -0) ? 0 : value),
    };
  });
  if (!isRecord(raw.config)) {
    throw new ValidationError('Scenario config must be an object.');
  }
  const coreConfig = normalizeSimConfig({
    integrator: /** @type {import('../core/world.js').SimConfig['integrator']} */ (
      raw.config.integrator
    ),
    dt: /** @type {number} */ (raw.config.dt),
    substeps: /** @type {number} */ (raw.config.substeps),
    softening: /** @type {number} */ (raw.config.softening),
    G: /** @type {number} */ (raw.config.G),
  });
  if (
    Math.abs(coreConfig.G - GRAVITATIONAL_CONSTANT) >
    Number.EPSILON * GRAVITATIONAL_CONSTANT
  ) {
    throw new ValidationError('Shared scenarios must use normalized G = 4π².');
  }
  if (coreConfig.dt < MIN_SCENARIO_DT || coreConfig.dt > MAX_SCENARIO_DT) {
    throw new ValidationError(
      `Scenario dt must be from ${MIN_SCENARIO_DT} to ${MAX_SCENARIO_DT} years.`,
    );
  }
  if (coreConfig.substeps > MAX_SCENARIO_SUBSTEPS) {
    throw new ValidationError(
      `Scenario substeps may not exceed ${MAX_SCENARIO_SUBSTEPS}.`,
    );
  }
  if (coreConfig.softening > MAX_SCENARIO_SOFTENING) {
    throw new ValidationError('Scenario softening exceeds the safe range.');
  }
  const timeScale =
    typeof raw.config.timeScale === 'number' ? raw.config.timeScale : 0.05;
  if (!Number.isFinite(timeScale) || !(timeScale > 0) || timeScale > 100) {
    throw new ValidationError('Scenario timeScale must satisfy 0 < value ≤ 100.');
  }
  const rendering = isRecord(raw.config.rendering) ? raw.config.rendering : {};
  const trailLength =
    typeof rendering.trailLength === 'number' ? rendering.trailLength : 512;
  if (
    !Number.isInteger(trailLength) ||
    trailLength < 32 ||
    trailLength > 4096
  ) {
    throw new ValidationError('Trail length must be an integer from 32 to 4096.');
  }
  const normalizedRendering = {
    trailLength,
    showVelocity: rendering.showVelocity === true,
    showContours: rendering.showContours === true,
    showRotatingFrame: rendering.showRotatingFrame === true,
  };
  if (!isRecord(raw.frame)) {
    throw new ValidationError('Scenario frame must be an object.');
  }
  const frameType = raw.frame.type;
  if (
    frameType !== 'inertial' &&
    frameType !== 'barycentric' &&
    frameType !== 'rotating'
  ) {
    throw new ValidationError(`Unknown scenario frame: ${String(frameType)}`);
  }
  const ids = new Set(bodies.map((body) => body.id));
  const refA =
    typeof raw.frame.refA === 'number' && Number.isInteger(raw.frame.refA)
      ? raw.frame.refA
      : null;
  const refB =
    typeof raw.frame.refB === 'number' && Number.isInteger(raw.frame.refB)
      ? raw.frame.refB
      : null;
  if (
    frameType === 'rotating' &&
    (refA == null ||
      refB == null ||
      refA === refB ||
      !ids.has(refA) ||
      !ids.has(refB))
  ) {
    throw new ValidationError(
      'Rotating scenarios require two distinct existing reference body IDs.',
    );
  }

  return {
    version: SCENARIO_VERSION,
    id,
    title,
    bodies,
    config: {
      ...coreConfig,
      timeScale,
      rendering: normalizedRendering,
    },
    frame: {
      type: frameType,
      refA: frameType === 'rotating' ? refA : null,
      refB: frameType === 'rotating' ? refB : null,
    },
  };
}

/** @param {Scenario | unknown} scenario */
export function encodeScenarioHash(scenario) {
  const normalized = validateScenario(scenario);
  const json = JSON.stringify(normalized);
  if (json.length > MAX_SCENARIO_JSON_LENGTH) {
    throw new ValidationError('Scenario JSON exceeds the safe sharing limit.');
  }
  const compressed = LZString.compressToEncodedURIComponent(json);
  const hash = `${SCENARIO_HASH_PREFIX}${compressed}`;
  if (hash.length > MAX_SCENARIO_HASH_LENGTH) {
    throw new ValidationError('Compressed scenario exceeds the safe URL limit.');
  }
  return hash;
}

/** @param {string} hash @returns {Scenario} */
export function decodeScenarioHash(hash) {
  if (typeof hash !== 'string' || hash.length > MAX_SCENARIO_HASH_LENGTH) {
    throw new ValidationError('Scenario hash is missing or exceeds the safe limit.');
  }
  if (!hash.startsWith(SCENARIO_HASH_PREFIX)) {
    throw new ValidationError('Scenario hash has an unsupported prefix or version.');
  }
  const compressed = hash.slice(SCENARIO_HASH_PREFIX.length);
  if (compressed.length === 0) {
    throw new ValidationError('Scenario hash does not contain a payload.');
  }
  const json = LZString.decompressFromEncodedURIComponent(compressed);
  if (typeof json !== 'string' || json.length === 0) {
    throw new ValidationError('Scenario hash could not be decompressed.');
  }
  if (json.length > MAX_SCENARIO_JSON_LENGTH) {
    throw new ValidationError('Decompressed scenario exceeds the safe payload limit.');
  }
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new ValidationError(
      `Scenario JSON is invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return validateScenario(parsed);
}
