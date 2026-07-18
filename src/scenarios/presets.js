import { GRAVITATIONAL_CONSTANT } from '../core/units.js';
import { createL4TadpolePreset } from './cr3bp.js';
import {
  createCircularBinaryFixture,
  createFigureEightFixture,
  createPlanetaryMassRatioFixture,
} from './reference.js';
import { SCENARIO_VERSION, validateScenario } from './schema.js';

/** @typedef {import('./schema.js').Scenario} Scenario */

/**
 * @param {ReturnType<typeof createCircularBinaryFixture>} fixture
 * @param {string} title
 * @param {number} timeScale
 * @returns {Scenario}
 */
function fromReferenceFixture(fixture, title, timeScale) {
  return validateScenario({
    version: SCENARIO_VERSION,
    id: fixture.id,
    title,
    bodies: fixture.bodies,
    config: {
      ...fixture.config,
      timeScale,
      rendering: {
        trailLength: 768,
        showVelocity: false,
        showContours: false,
        showRotatingFrame: false,
      },
    },
    frame: { type: 'barycentric', refA: null, refB: null },
  });
}

/** @returns {Scenario} */
export function createCircularBinaryScenario() {
  return fromReferenceFixture(
    createCircularBinaryFixture(),
    '원형 이체계',
    0.08,
  );
}

/** @returns {Scenario} */
export function createPlanetaryScenario() {
  return fromReferenceFixture(
    createPlanetaryMassRatioFixture(),
    '주성–행성 근사계',
    0.12,
  );
}

/** @returns {Scenario} */
export function createFigureEightScenario() {
  return fromReferenceFixture(
    createFigureEightFixture(),
    'Figure-8 삼체',
    0.06,
  );
}

/** @returns {Scenario} */
export function createCr3bpTadpoleScenario() {
  const preset = createL4TadpolePreset();
  return validateScenario({
    version: SCENARIO_VERSION,
    id: preset.id,
    title: 'CR3BP L4 Tadpole',
    bodies: preset.bodies,
    config: {
      ...preset.config,
      G: GRAVITATIONAL_CONSTANT,
      timeScale: 0.08,
      rendering: {
        trailLength: 1024,
        showVelocity: false,
        showContours: true,
        showRotatingFrame: true,
      },
    },
    frame: { type: 'rotating', refA: 1, refB: 2 },
  });
}

/** @returns {Scenario[]} */
export function createPresetScenarios() {
  return [
    createCircularBinaryScenario(),
    createPlanetaryScenario(),
    createFigureEightScenario(),
    createCr3bpTadpoleScenario(),
  ];
}

/** @param {string} id @returns {Scenario} */
export function getPresetScenario(id) {
  return (
    createPresetScenarios().find((scenario) => scenario.id === id) ??
    createCircularBinaryScenario()
  );
}
