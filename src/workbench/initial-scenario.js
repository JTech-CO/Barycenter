import { createCircularBinaryScenario } from '../scenarios/presets.js';
import {
  decodeScenarioHash,
  SCENARIO_HASH_PREFIX,
} from '../scenarios/schema.js';

/**
 * @param {string} hash
 * @returns {{scenario: import('../scenarios/schema.js').Scenario, warning: string | null}}
 */
export function resolveInitialScenario(hash) {
  const fallback = createCircularBinaryScenario();
  if (!hash || !hash.startsWith(SCENARIO_HASH_PREFIX)) {
    return { scenario: fallback, warning: null };
  }
  try {
    return { scenario: decodeScenarioHash(hash), warning: null };
  } catch (error) {
    return {
      scenario: fallback,
      warning:
        'The shared scenario was rejected and the Circular Binary preset was loaded. ' +
        (error instanceof Error ? error.message : String(error)),
    };
  }
}
