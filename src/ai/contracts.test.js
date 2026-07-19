import { describe, expect, it } from 'vitest';
import { createWorld, stepWorld } from '../core/world.js';
import { createCircularBinaryScenario } from '../scenarios/presets.js';
import {
  MAX_DRAFT_BYTES,
  SCENARIO_DRAFT_ERROR_CODES,
  SCENARIO_DRAFT_JSON_SCHEMA,
  createScenarioDraft,
  validateScenarioDraft,
} from './contracts.js';
import { interpretScenarioPromptLocally } from './local-interpreter.js';

/** @param {unknown} value */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

describe('ScenarioDraft v1 contract', () => {
  it('publishes a strict provider-independent JSON Schema', () => {
    expect(SCENARIO_DRAFT_JSON_SCHEMA.$schema).toContain('2020-12');
    expect(SCENARIO_DRAFT_JSON_SCHEMA.additionalProperties).toBe(false);
    expect(SCENARIO_DRAFT_JSON_SCHEMA.required).toEqual([
      'version',
      'units',
      'scenario',
    ]);
  });

  it('turns the representative plain-language request into an integrable draft', () => {
    const draft = interpretScenarioPromptLocally(
      '태양 두 개와 그 주위를 도는 행성',
    );
    expect(draft.version).toBe(1);
    expect(draft.units).toEqual({
      length: 'AU',
      time: 'yr',
      mass: 'solar-mass',
      velocity: 'AU/yr',
      gravitationalConstant: '4*pi^2',
    });
    expect(draft.scenario.bodies).toHaveLength(3);

    const world = createWorld(draft.scenario.bodies, draft.scenario.config);
    expect(stepWorld(world, 100).ok).toBe(true);
    expect(world.step).toBe(100);
  });

  const invalidCases = /** @type {[string, (draft: any) => void][]} */ ([
    ['negative mass', (draft) => {
      draft.scenario.bodies[0].mass = -1;
    }],
    ['non-finite position', (draft) => {
      draft.scenario.bodies[0].position[0] = Number.POSITIVE_INFINITY;
    }],
    ['missing config', (draft) => {
      delete draft.scenario.config;
    }],
    ['duplicate body id', (draft) => {
      draft.scenario.bodies[1].id = draft.scenario.bodies[0].id;
    }],
    ['unknown version', (draft) => {
      draft.version = 2;
    }],
    ['wrong units', (draft) => {
      draft.units.length = 'km';
    }],
  ]);
  it.each(invalidCases)('rejects %s before core injection', (_label, mutate) => {
    const draft = clone(createScenarioDraft(createCircularBinaryScenario()));
    mutate(draft);
    try {
      validateScenarioDraft(draft);
      throw new Error('Expected ScenarioDraft validation to fail.');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'ScenarioDraftError',
        code: SCENARIO_DRAFT_ERROR_CODES.DRAFT_INVALID,
        stage: 'validation',
      });
    }
  });

  it('rejects oversized and unknown fields', () => {
    const oversized = clone(createScenarioDraft(createCircularBinaryScenario()));
    oversized.untrustedPadding = 'x'.repeat(MAX_DRAFT_BYTES);
    expect(() => validateScenarioDraft(oversized)).toThrow(/byte response limit/);

    const unknown = clone(createScenarioDraft(createCircularBinaryScenario()));
    unknown.scenario.untrusted = true;
    expect(() => validateScenarioDraft(unknown)).toThrow(/Unknown field/);
  });

  it('returns a serializable stable error payload', () => {
    try {
      validateScenarioDraft({ version: 99 });
      throw new Error('Expected validation failure.');
    } catch (error) {
      expect(error).toMatchObject({ name: 'ScenarioDraftError' });
      const serialized = JSON.parse(JSON.stringify(error));
      expect(serialized.error).toMatchObject({
        version: 1,
        code: SCENARIO_DRAFT_ERROR_CODES.DRAFT_INVALID,
        stage: 'validation',
        retryable: false,
      });
    }
  });
});
