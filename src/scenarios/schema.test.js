import LZString from 'lz-string';
import { describe, expect, it } from 'vitest';
import { createWorld, stepWorld } from '../core/world.js';
import { createCircularBinaryScenario } from './presets.js';
import {
  MAX_SCENARIO_HASH_LENGTH,
  SCENARIO_HASH_PREFIX,
  decodeScenarioHash,
  encodeScenarioHash,
  validateScenario,
} from './schema.js';

describe('versioned scenario sharing', () => {
  it('round-trips a normalized scenario through an LZ URL hash', () => {
    const scenario = createCircularBinaryScenario();
    const hash = encodeScenarioHash(scenario);
    const restored = decodeScenarioHash(hash);

    expect(hash.startsWith(SCENARIO_HASH_PREFIX)).toBe(true);
    expect(restored).toEqual(scenario);
    expect(encodeScenarioHash(restored)).toBe(hash);
  });

  it('replays the same CPU trajectory after URL restoration', () => {
    const original = createCircularBinaryScenario();
    const restored = decodeScenarioHash(encodeScenarioHash(original));
    const worlds = [original, restored].map((scenario) =>
      createWorld(scenario.bodies, scenario.config),
    );

    for (const world of worlds) expect(stepWorld(world, 500).ok).toBe(true);

    expect([...worlds[1].state.positions]).toEqual([...worlds[0].state.positions]);
    expect([...worlds[1].state.velocities]).toEqual([...worlds[0].state.velocities]);
  });

  it('rejects invalid bodies, frames, versions, and oversized hashes', () => {
    const scenario = createCircularBinaryScenario();
    expect(() =>
      validateScenario({
        ...scenario,
        bodies: [{ ...scenario.bodies[0], mass: -1 }],
      }),
    ).toThrow(/mass/);
    expect(() =>
      validateScenario({
        ...scenario,
        frame: { type: 'rotating', refA: 1, refB: 999 },
      }),
    ).toThrow(/reference/);
    expect(() =>
      decodeScenarioHash('#scenario=2.untrusted'),
    ).toThrow(/prefix|version/);
    expect(() =>
      validateScenario({
        ...scenario,
        config: { ...scenario.config, substeps: 1_000_000 },
      }),
    ).toThrow(/substeps/);
    expect(() => decodeScenarioHash(`#scenario=1.${'a'.repeat(MAX_SCENARIO_HASH_LENGTH)}`)).toThrow(
      /limit/,
    );
  });

  it('rejects decompressed payloads before loader injection', () => {
    const invalid = JSON.stringify({
      version: 1,
      id: 'invalid',
      title: 'Invalid',
      bodies: [],
      config: {},
      frame: { type: 'inertial' },
      __protoPollutionAttempt: { polluted: true },
    });
    const hash = `${SCENARIO_HASH_PREFIX}${LZString.compressToEncodedURIComponent(invalid)}`;

    expect(() => decodeScenarioHash(hash)).toThrow();
    expect(/** @type {Record<string, unknown>} */ ({}).polluted).toBeUndefined();
  });
});
