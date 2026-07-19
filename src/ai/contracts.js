import { validateScenario } from '../scenarios/schema.js';

/** @typedef {import('../scenarios/schema.js').Scenario} Scenario */

export const SCENARIO_DRAFT_VERSION = 1;
export const MAX_PROMPT_BYTES = 4_096;
export const MAX_DRAFT_BYTES = 131_072;
export const MAX_DRAFT_BODIES = 64;
export const MAX_DRAFT_PHYSICAL_MAGNITUDE = 1_000_000;

export const SCENARIO_DRAFT_UNITS = Object.freeze({
  length: 'AU',
  time: 'yr',
  mass: 'solar-mass',
  velocity: 'AU/yr',
  gravitationalConstant: '4*pi^2',
});

export const SCENARIO_DRAFT_ERROR_CODES = Object.freeze({
  CONFIGURATION: 'configuration_error',
  INPUT: 'input_invalid',
  TIMEOUT: 'request_timeout',
  PROVIDER: 'provider_error',
  RESPONSE_TOO_LARGE: 'response_too_large',
  RESPONSE_INVALID: 'response_invalid',
  DRAFT_INVALID: 'draft_invalid',
  UNSUPPORTED_PROMPT: 'unsupported_prompt',
});

/**
 * Provider-independent JSON Schema supplied to structured-output adapters.
 * Runtime validation remains authoritative because JSON Schema alone cannot
 * express every cross-field invariant (for example unique body IDs).
 */
export const SCENARIO_DRAFT_JSON_SCHEMA = Object.freeze({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://barycenter.local/contracts/scenario-draft-v1.schema.json',
  title: 'Barycenter ScenarioDraft v1',
  type: 'object',
  additionalProperties: false,
  required: ['version', 'units', 'scenario'],
  properties: {
    version: { const: SCENARIO_DRAFT_VERSION },
    units: {
      type: 'object',
      additionalProperties: false,
      required: [
        'length',
        'time',
        'mass',
        'velocity',
        'gravitationalConstant',
      ],
      properties: {
        length: { const: SCENARIO_DRAFT_UNITS.length },
        time: { const: SCENARIO_DRAFT_UNITS.time },
        mass: { const: SCENARIO_DRAFT_UNITS.mass },
        velocity: { const: SCENARIO_DRAFT_UNITS.velocity },
        gravitationalConstant: {
          const: SCENARIO_DRAFT_UNITS.gravitationalConstant,
        },
      },
    },
    scenario: {
      type: 'object',
      additionalProperties: false,
      required: ['version', 'id', 'title', 'bodies', 'config', 'frame'],
      properties: {
        version: { const: 1 },
        id: {
          type: 'string',
          minLength: 1,
          maxLength: 64,
          pattern: '^[A-Za-z0-9][A-Za-z0-9-]*$',
        },
        title: { type: 'string', minLength: 1, maxLength: 80 },
        bodies: {
          type: 'array',
          minItems: 1,
          maxItems: MAX_DRAFT_BODIES,
          items: {
            type: 'object',
            additionalProperties: false,
            required: [
              'id',
              'name',
              'kind',
              'mass',
              'position',
              'velocity',
            ],
            properties: {
              id: {
                type: 'integer',
                minimum: -2_147_483_648,
                maximum: 2_147_483_647,
              },
              name: { type: 'string', minLength: 1, maxLength: 80 },
              kind: { enum: ['massive', 'tracer'] },
              mass: {
                type: 'number',
                minimum: 0,
                maximum: MAX_DRAFT_PHYSICAL_MAGNITUDE,
              },
              position: {
                type: 'array',
                minItems: 3,
                maxItems: 3,
                items: {
                  type: 'number',
                  minimum: -MAX_DRAFT_PHYSICAL_MAGNITUDE,
                  maximum: MAX_DRAFT_PHYSICAL_MAGNITUDE,
                },
              },
              velocity: {
                type: 'array',
                minItems: 3,
                maxItems: 3,
                items: {
                  type: 'number',
                  minimum: -MAX_DRAFT_PHYSICAL_MAGNITUDE,
                  maximum: MAX_DRAFT_PHYSICAL_MAGNITUDE,
                },
              },
              radius: {
                type: 'number',
                exclusiveMinimum: 0,
                maximum: MAX_DRAFT_PHYSICAL_MAGNITUDE,
              },
              fixed: { type: 'boolean' },
            },
          },
        },
        config: {
          type: 'object',
          additionalProperties: false,
          required: [
            'integrator',
            'dt',
            'substeps',
            'softening',
            'G',
            'timeScale',
            'rendering',
          ],
          properties: {
            integrator: { enum: ['leapfrog', 'yoshida4', 'rk4'] },
            dt: { type: 'number', exclusiveMinimum: 0, maximum: 100 },
            substeps: { type: 'integer', minimum: 1, maximum: 256 },
            softening: { type: 'number', minimum: 0, maximum: 1_000_000 },
            G: { type: 'number' },
            timeScale: { type: 'number', exclusiveMinimum: 0, maximum: 100 },
            rendering: {
              type: 'object',
              additionalProperties: false,
              required: [
                'trailLength',
                'showVelocity',
                'showContours',
                'showRotatingFrame',
              ],
              properties: {
                trailLength: {
                  type: 'integer',
                  minimum: 32,
                  maximum: 4_096,
                },
                showVelocity: { type: 'boolean' },
                showContours: { type: 'boolean' },
                showRotatingFrame: { type: 'boolean' },
              },
            },
          },
        },
        frame: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'refA', 'refB'],
          properties: {
            type: { enum: ['inertial', 'barycentric', 'rotating'] },
            refA: { type: ['integer', 'null'] },
            refB: { type: ['integer', 'null'] },
          },
        },
      },
    },
  },
});

/**
 * @typedef {object} ScenarioDraft
 * @property {1} version
 * @property {typeof SCENARIO_DRAFT_UNITS} units
 * @property {Scenario} scenario
 */

export class ScenarioDraftError extends Error {
  /**
   * @param {string} code
   * @param {'configuration' | 'input' | 'transport' | 'provider' | 'validation'} stage
   * @param {string} message
   * @param {{retryable?: boolean, issues?: {path: string, message: string}[], status?: number | null, cause?: unknown}} [options]
   */
  constructor(code, stage, message, options = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'ScenarioDraftError';
    this.code = code;
    this.stage = stage;
    this.retryable = options.retryable === true;
    this.issues = options.issues ?? [];
    this.status = options.status ?? null;
  }

  toJSON() {
    return {
      error: {
        version: 1,
        code: this.code,
        stage: this.stage,
        message: this.message,
        retryable: this.retryable,
        issues: this.issues,
      },
    };
  }
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param {Record<string, unknown>} value @param {string[]} required @param {string[]} allowed @param {string} path */
function assertObjectShape(value, required, allowed, path) {
  for (const key of required) {
    if (!Object.hasOwn(value, key)) {
      throw invalidDraft(path + '.' + key, 'Required field is missing.');
    }
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw invalidDraft(path + '.' + key, 'Unknown field is not allowed.');
    }
  }
}

/** @param {string} path @param {string} message */
function invalidDraft(path, message) {
  return new ScenarioDraftError(
    SCENARIO_DRAFT_ERROR_CODES.DRAFT_INVALID,
    'validation',
    path + ': ' + message,
    { issues: [{ path, message }] },
  );
}

/** @param {unknown} value */
function measureJsonBytes(value) {
  let json;
  try {
    json = JSON.stringify(value);
  } catch (error) {
    throw new ScenarioDraftError(
      SCENARIO_DRAFT_ERROR_CODES.RESPONSE_INVALID,
      'validation',
      'ScenarioDraft must be serializable JSON.',
      { cause: error },
    );
  }
  if (typeof json !== 'string') {
    throw new ScenarioDraftError(
      SCENARIO_DRAFT_ERROR_CODES.RESPONSE_INVALID,
      'validation',
      'ScenarioDraft must be a JSON object.',
    );
  }
  return new TextEncoder().encode(json).byteLength;
}

/** @param {unknown} prompt */
export function validateScenarioPrompt(prompt) {
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new ScenarioDraftError(
      SCENARIO_DRAFT_ERROR_CODES.INPUT,
      'input',
      'Describe a gravitational system before requesting a draft.',
    );
  }
  const normalized = prompt.normalize('NFKC').trim();
  if (new TextEncoder().encode(normalized).byteLength > MAX_PROMPT_BYTES) {
    throw new ScenarioDraftError(
      SCENARIO_DRAFT_ERROR_CODES.INPUT,
      'input',
      'Scenario description exceeds the 4096-byte input limit.',
    );
  }
  return normalized;
}

/** @param {Scenario | unknown} scenario @returns {ScenarioDraft} */
export function createScenarioDraft(scenario) {
  return validateScenarioDraft({
    version: SCENARIO_DRAFT_VERSION,
    units: SCENARIO_DRAFT_UNITS,
    scenario,
  });
}

/** @param {unknown} raw @returns {ScenarioDraft} */
export function validateScenarioDraft(raw) {
  if (measureJsonBytes(raw) > MAX_DRAFT_BYTES) {
    throw new ScenarioDraftError(
      SCENARIO_DRAFT_ERROR_CODES.RESPONSE_TOO_LARGE,
      'validation',
      'ScenarioDraft exceeds the 131072-byte response limit.',
    );
  }
  if (!isRecord(raw)) throw invalidDraft('$', 'Expected an object.');
  assertObjectShape(
    raw,
    ['version', 'units', 'scenario'],
    ['version', 'units', 'scenario'],
    '$',
  );
  if (raw.version !== SCENARIO_DRAFT_VERSION) {
    throw invalidDraft('$.version', 'Unsupported ScenarioDraft version.');
  }
  if (!isRecord(raw.units)) throw invalidDraft('$.units', 'Expected an object.');
  const unitKeys = /** @type {(keyof typeof SCENARIO_DRAFT_UNITS)[]} */ (
    Object.keys(SCENARIO_DRAFT_UNITS)
  );
  assertObjectShape(raw.units, unitKeys, unitKeys, '$.units');
  for (const key of unitKeys) {
    if (raw.units[key] !== SCENARIO_DRAFT_UNITS[key]) {
      throw invalidDraft(
        '$.units.' + key,
        'Expected normalized Barycenter units.',
      );
    }
  }
  if (!isRecord(raw.scenario)) {
    throw invalidDraft('$.scenario', 'Expected an object.');
  }
  assertObjectShape(
    raw.scenario,
    ['version', 'id', 'title', 'bodies', 'config', 'frame'],
    ['version', 'id', 'title', 'bodies', 'config', 'frame'],
    '$.scenario',
  );
  if (!Array.isArray(raw.scenario.bodies)) {
    throw invalidDraft('$.scenario.bodies', 'Expected an array.');
  }
  if (raw.scenario.bodies.length > MAX_DRAFT_BODIES) {
    throw invalidDraft(
      '$.scenario.bodies',
      'At most ' + MAX_DRAFT_BODIES + ' bodies are allowed.',
    );
  }
  raw.scenario.bodies.forEach((body, index) => {
    if (!isRecord(body)) {
      throw invalidDraft('$.scenario.bodies[' + index + ']', 'Expected an object.');
    }
    assertObjectShape(
      body,
      ['id', 'name', 'kind', 'mass', 'position', 'velocity'],
      ['id', 'name', 'kind', 'mass', 'position', 'velocity', 'radius', 'fixed'],
      '$.scenario.bodies[' + index + ']',
    );
  });
  if (!isRecord(raw.scenario.config)) {
    throw invalidDraft('$.scenario.config', 'Expected an object.');
  }
  assertObjectShape(
    raw.scenario.config,
    ['integrator', 'dt', 'substeps', 'softening', 'G', 'timeScale', 'rendering'],
    ['integrator', 'dt', 'substeps', 'softening', 'G', 'timeScale', 'rendering'],
    '$.scenario.config',
  );
  if (!isRecord(raw.scenario.config.rendering)) {
    throw invalidDraft('$.scenario.config.rendering', 'Expected an object.');
  }
  assertObjectShape(
    raw.scenario.config.rendering,
    ['trailLength', 'showVelocity', 'showContours', 'showRotatingFrame'],
    ['trailLength', 'showVelocity', 'showContours', 'showRotatingFrame'],
    '$.scenario.config.rendering',
  );
  if (!isRecord(raw.scenario.frame)) {
    throw invalidDraft('$.scenario.frame', 'Expected an object.');
  }
  assertObjectShape(
    raw.scenario.frame,
    ['type', 'refA', 'refB'],
    ['type', 'refA', 'refB'],
    '$.scenario.frame',
  );

  let scenario;
  try {
    scenario = validateScenario(raw.scenario);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ScenarioDraftError(
      SCENARIO_DRAFT_ERROR_CODES.DRAFT_INVALID,
      'validation',
      'Scenario failed physical validation: ' + message,
      {
        issues: [{ path: '$.scenario', message }],
        cause: error,
      },
    );
  }
  for (const [index, body] of scenario.bodies.entries()) {
    const values = [
      body.mass,
      body.radius ?? 1,
      ...Array.from(body.position),
      ...Array.from(body.velocity),
    ];
    if (
      values.some(
        (value) =>
          !Number.isFinite(value) ||
          Math.abs(value) > MAX_DRAFT_PHYSICAL_MAGNITUDE,
      )
    ) {
      throw invalidDraft(
        '$.scenario.bodies[' + index + ']',
        'Mass, radius, position, and velocity must be finite and within the natural-language safety range.',
      );
    }
  }
  return {
    version: SCENARIO_DRAFT_VERSION,
    units: { ...SCENARIO_DRAFT_UNITS },
    scenario,
  };
}

/** @param {unknown} error @param {string} [fallbackMessage] */
export function asScenarioDraftError(
  error,
  fallbackMessage = 'Natural-language scenario request failed.',
) {
  if (error instanceof ScenarioDraftError) return error;
  return new ScenarioDraftError(
    SCENARIO_DRAFT_ERROR_CODES.RESPONSE_INVALID,
    'validation',
    fallbackMessage,
    { cause: error },
  );
}
