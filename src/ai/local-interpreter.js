import { GRAVITATIONAL_CONSTANT } from '../core/units.js';
import {
  createCircularBinaryScenario,
  createCr3bpTadpoleScenario,
  createFigureEightScenario,
  createPlanetaryScenario,
} from '../scenarios/presets.js';
import { SCENARIO_VERSION, validateScenario } from '../scenarios/schema.js';
import {
  SCENARIO_DRAFT_ERROR_CODES,
  ScenarioDraftError,
  createScenarioDraft,
  validateScenarioPrompt,
} from './contracts.js';

/** @typedef {import('./contracts.js').ScenarioDraft} ScenarioDraft */

/** @param {import('../scenarios/schema.js').Scenario} scenario @param {string} id @param {string} title */
function relabelScenario(scenario, id, title) {
  return validateScenario({ ...scenario, id, title });
}

/** @returns {import('../scenarios/schema.js').Scenario} */
export function createCircumbinaryPlanetScenario() {
  const stellarMass = 0.5;
  const planetMass = 3.003e-6;
  const binaryRadius = 0.5;
  const planetRadius = 3;
  const stellarAngularRate = Math.sqrt(
    (GRAVITATIONAL_CONSTANT * stellarMass * 2) /
      Math.pow(binaryRadius * 2, 3),
  );
  const planetSpeed = Math.sqrt(
    (GRAVITATIONAL_CONSTANT * stellarMass * 2) / planetRadius,
  );
  const totalMass = stellarMass * 2 + planetMass;
  const centerX = (planetMass * planetRadius) / totalMass;
  const centerVelocity = (planetMass * planetSpeed) / totalMass;

  return validateScenario({
    version: SCENARIO_VERSION,
    id: 'natural-circumbinary-planet',
    title: '쌍성 주위를 도는 행성',
    bodies: [
      {
        id: 1,
        name: 'Primary A',
        kind: 'massive',
        mass: stellarMass,
        position: [-binaryRadius - centerX, 0, 0],
        velocity: [0, -stellarAngularRate * binaryRadius - centerVelocity, 0],
        radius: 1.15,
        fixed: false,
      },
      {
        id: 2,
        name: 'Primary B',
        kind: 'massive',
        mass: stellarMass,
        position: [binaryRadius - centerX, 0, 0],
        velocity: [0, stellarAngularRate * binaryRadius - centerVelocity, 0],
        radius: 1.15,
        fixed: false,
      },
      {
        id: 3,
        name: 'Circumbinary planet',
        kind: 'massive',
        mass: planetMass,
        position: [planetRadius - centerX, 0, 0],
        velocity: [0, planetSpeed - centerVelocity, 0],
        radius: 0.62,
        fixed: false,
      },
    ],
    config: {
      integrator: 'leapfrog',
      dt: 1 / 4_096,
      substeps: 1,
      softening: 1e-6,
      G: GRAVITATIONAL_CONSTANT,
      timeScale: 0.1,
      rendering: {
        trailLength: 1_024,
        showVelocity: false,
        showContours: false,
        showRotatingFrame: false,
      },
    },
    frame: { type: 'barycentric', refA: null, refB: null },
  });
}

/**
 * A deterministic, offline reference interpreter. It keeps the static build
 * useful and provides contract fixtures before a paid provider is selected.
 *
 * @param {unknown} prompt
 * @returns {ScenarioDraft}
 */
export function interpretScenarioPromptLocally(prompt) {
  const normalized = validateScenarioPrompt(prompt);
  const search = normalized.toLocaleLowerCase('ko-KR');

  if (
    /(태양|별).*(두|2).*(행성)|행성.*(쌍성|두.*태양)|circumbinary|two (suns|stars).*(planet)/u.test(
      search,
    )
  ) {
    return createScenarioDraft(createCircumbinaryPlanetScenario());
  }
  if (
    /figure\s*[- ]?8|figure eight|8자|피겨\s*8|삼체.*8/u.test(search)
  ) {
    return createScenarioDraft(
      relabelScenario(
        createFigureEightScenario(),
        'natural-figure-eight',
        '자연어 Figure-8 삼체',
      ),
    );
  }
  if (
    /\bl4\b|라그랑주.*4|tadpole|올챙이|트로이/u.test(search)
  ) {
    return createScenarioDraft(
      relabelScenario(
        createCr3bpTadpoleScenario(),
        'natural-l4-tadpole',
        '자연어 CR3BP L4 Tadpole',
      ),
    );
  }
  if (
    /쌍성|이체|binary|two[- ]body|두.*(별|천체|태양)/u.test(search)
  ) {
    return createScenarioDraft(
      relabelScenario(
        createCircularBinaryScenario(),
        'natural-circular-binary',
        '자연어 원형 이체계',
      ),
    );
  }
  if (
    /행성|지구|태양계|planet|earth|star.*orbit|sun.*orbit/u.test(search)
  ) {
    return createScenarioDraft(
      relabelScenario(
        createPlanetaryScenario(),
        'natural-planetary-system',
        '자연어 주성–행성계',
      ),
    );
  }

  throw new ScenarioDraftError(
    SCENARIO_DRAFT_ERROR_CODES.UNSUPPORTED_PROMPT,
    'input',
    'The built-in reference interpreter recognizes binary, circumbinary planet, Figure-8, planetary, and L4 tadpole scenarios. Rephrase with one of those systems or configure the optional proxy.',
  );
}
