import { ValidationError } from '../core/errors.js';
import { INTEGRATORS } from '../core/integrators.js';
import { elementsToState } from '../core/kepler.js';
import { GRAVITATIONAL_CONSTANT } from '../core/units.js';
import { normalizeSimConfig } from '../core/world.js';

/** @typedef {import('../core/state.js').Body} Body */
/** @typedef {import('../core/world.js').SimConfig} SimConfig */

/**
 * @typedef {object} ReferenceFixture
 * @property {string} id
 * @property {string} label
 * @property {string} category
 * @property {string} source
 * @property {string} sourceUrl
 * @property {string} unitConversion
 * @property {Body[]} bodies
 * @property {SimConfig} config
 * @property {number | null} referencePeriod
 * @property {Record<string, number>} expected
 * @property {Record<string, number>} tolerances
 */

const TWO_PI = 2 * Math.PI;
const FIGURE_EIGHT_G1_PERIOD = 6.32591398;

export const REFERENCE_FIXTURE_IDS = Object.freeze({
  CIRCULAR_BINARY: 'circular-binary',
  ECCENTRIC_BINARY: 'eccentric-binary',
  PLANETARY_MASS_RATIO: 'planetary-mass-ratio',
  FIGURE_EIGHT: 'figure-eight',
  LOW_MOMENTUM_SYMMETRY: 'low-momentum-symmetry',
  SOFTENED_CLOSE_ENCOUNTER: 'softened-close-encounter',
});

/**
 * Construct exact barycentric Cartesian initial conditions from relative
 * elliptic elements. The relative vector points from body 1 to body 2.
 *
 * @param {number} primaryMass
 * @param {number} secondaryMass
 * @param {number} semiMajorAxis
 * @param {number} eccentricity
 * @param {number} trueAnomaly
 * @param {number} gravitationalConstant
 * @returns {Body[]}
 */
function createBarycentricBinaryBodies(
  primaryMass,
  secondaryMass,
  semiMajorAxis,
  eccentricity,
  trueAnomaly,
  gravitationalConstant,
) {
  const totalMass = primaryMass + secondaryMass;
  const relative = elementsToState(
    {
      a: semiMajorAxis,
      e: eccentricity,
      i: 0,
      Omega: 0,
      omega: 0,
      anomaly: { type: 'true', value: trueAnomaly },
    },
    gravitationalConstant * totalMass,
  );
  const primaryScale = -secondaryMass / totalMass;
  const secondaryScale = primaryMass / totalMass;
  /** @param {ArrayLike<number>} value @param {number} scale */
  const scaleVector = (value, scale) => [
    value[0] * scale,
    value[1] * scale,
    value[2] * scale,
  ];

  return [
    {
      id: 1,
      name: 'Primary',
      kind: 'massive',
      mass: primaryMass,
      position: scaleVector(relative.position, primaryScale),
      velocity: scaleVector(relative.velocity, primaryScale),
      radius: 0.04,
    },
    {
      id: 2,
      name: 'Secondary',
      kind: 'massive',
      mass: secondaryMass,
      position: scaleVector(relative.position, secondaryScale),
      velocity: scaleVector(relative.velocity, secondaryScale),
      radius: 0.025,
    },
  ];
}

/** @param {number} semiMajorAxis @param {number} totalMass */
function keplerPeriod(semiMajorAxis, totalMass) {
  return TWO_PI * Math.sqrt(
    semiMajorAxis ** 3 / (GRAVITATIONAL_CONSTANT * totalMass),
  );
}

/** @returns {ReferenceFixture} */
export function createCircularBinaryFixture() {
  const primaryMass = 1;
  const secondaryMass = 1;
  const semiMajorAxis = 1;
  const period = keplerPeriod(semiMajorAxis, primaryMass + secondaryMass);
  return {
    id: REFERENCE_FIXTURE_IDS.CIRCULAR_BINARY,
    label: 'Equal-mass circular binary',
    category: 'analytic-two-body',
    source: 'Newtonian two-body circular solution and Kepler third law',
    sourceUrl: 'https://science.nasa.gov/solar-system/orbits-and-keplers-laws/',
    unitConversion: 'Constructed directly in AU, yr, M☉ with G = 4π².',
    bodies: createBarycentricBinaryBodies(
      primaryMass,
      secondaryMass,
      semiMajorAxis,
      0,
      0,
      GRAVITATIONAL_CONSTANT,
    ),
    config: normalizeSimConfig({
      integrator: INTEGRATORS.LEAPFROG,
      dt: period / 512,
      substeps: 1,
      softening: 0,
      G: GRAVITATIONAL_CONSTANT,
    }),
    referencePeriod: period,
    expected: { semiMajorAxis, eccentricity: 0 },
    tolerances: {
      periodRelative: 1e-4,
      semiMajorRelative: 1e-4,
      eccentricityAbsolute: 1e-4,
      angularMomentum: 1e-10,
      centerOfMass: 1e-10,
    },
  };
}

/** @returns {ReferenceFixture} */
export function createEccentricBinaryFixture() {
  const primaryMass = 1;
  const secondaryMass = 0.2;
  const semiMajorAxis = 1.4;
  const eccentricity = 0.6;
  const period = keplerPeriod(semiMajorAxis, primaryMass + secondaryMass);
  return {
    id: REFERENCE_FIXTURE_IDS.ECCENTRIC_BINARY,
    label: 'Eccentric binary',
    category: 'analytic-two-body',
    source: 'Barycentric elliptic Kepler solution initialized at periapsis',
    sourceUrl: 'https://science.nasa.gov/solar-system/orbits-and-keplers-laws/',
    unitConversion: 'Constructed directly in AU, yr, M☉ with G = 4π².',
    bodies: createBarycentricBinaryBodies(
      primaryMass,
      secondaryMass,
      semiMajorAxis,
      eccentricity,
      0,
      GRAVITATIONAL_CONSTANT,
    ),
    config: normalizeSimConfig({
      integrator: INTEGRATORS.YOSHIDA4,
      dt: period / 2048,
      substeps: 1,
      softening: 0,
      G: GRAVITATIONAL_CONSTANT,
    }),
    referencePeriod: period,
    expected: { semiMajorAxis, eccentricity },
    tolerances: {
      periodRelative: 1e-4,
      semiMajorRelative: 2e-4,
      eccentricityAbsolute: 2e-4,
      angularMomentum: 1e-9,
      centerOfMass: 1e-10,
    },
  };
}

/** @returns {ReferenceFixture} */
export function createPlanetaryMassRatioFixture() {
  const primaryMass = 1;
  const secondaryMass = 3e-6;
  const semiMajorAxis = 1;
  const eccentricity = 0.0167;
  const period = keplerPeriod(semiMajorAxis, primaryMass + secondaryMass);
  return {
    id: REFERENCE_FIXTURE_IDS.PLANETARY_MASS_RATIO,
    label: 'Large mass-ratio planetary orbit',
    category: 'analytic-two-body',
    source: 'Barycentric elliptic Kepler construction with a 3×10⁻⁶ mass ratio',
    sourceUrl: 'https://science.nasa.gov/solar-system/orbits-and-keplers-laws/',
    unitConversion: 'Constructed directly in AU, yr, M☉ with G = 4π².',
    bodies: createBarycentricBinaryBodies(
      primaryMass,
      secondaryMass,
      semiMajorAxis,
      eccentricity,
      0,
      GRAVITATIONAL_CONSTANT,
    ),
    config: normalizeSimConfig({
      integrator: INTEGRATORS.LEAPFROG,
      dt: period / 1024,
      substeps: 1,
      softening: 0,
      G: GRAVITATIONAL_CONSTANT,
    }),
    referencePeriod: period,
    expected: { semiMajorAxis, eccentricity, massRatio: 3e-6 },
    tolerances: {
      periodRelative: 1e-4,
      semiMajorRelative: 1e-4,
      eccentricityAbsolute: 1e-4,
      angularMomentum: 1e-9,
      centerOfMass: 1e-10,
    },
  };
}

/** @returns {ReferenceFixture} */
export function createFigureEightFixture() {
  const velocityScale = Math.sqrt(GRAVITATIONAL_CONSTANT);
  const period = FIGURE_EIGHT_G1_PERIOD / velocityScale;
  /** @param {number[]} velocity */
  const scaleVelocity = (velocity) => velocity.map(
    (component) => component * velocityScale,
  );
  return {
    id: REFERENCE_FIXTURE_IDS.FIGURE_EIGHT,
    label: 'Chenciner–Montgomery figure-8',
    category: 'periodic-three-body',
    source: 'Carles Simó initial conditions; Chenciner–Montgomery orbit',
    sourceUrl: 'https://people.ucsc.edu/~rmont/Nbdy/NbdyC1.html',
    unitConversion:
      'Published G=1 positions are treated as AU; velocities are multiplied by √(4π²)=2π and period divided by 2π.',
    bodies: [
      {
        id: 1,
        name: 'Eight A',
        kind: 'massive',
        mass: 1,
        position: [0.97000436, -0.24308753, 0],
        velocity: scaleVelocity([0.466203685, 0.43236573, 0]),
        radius: 0.025,
      },
      {
        id: 2,
        name: 'Eight B',
        kind: 'massive',
        mass: 1,
        position: [-0.97000436, 0.24308753, 0],
        velocity: scaleVelocity([0.466203685, 0.43236573, 0]),
        radius: 0.025,
      },
      {
        id: 3,
        name: 'Eight C',
        kind: 'massive',
        mass: 1,
        position: [0, 0, 0],
        velocity: scaleVelocity([-0.93240737, -0.86473146, 0]),
        radius: 0.025,
      },
    ],
    config: normalizeSimConfig({
      integrator: INTEGRATORS.YOSHIDA4,
      dt: period / 1024,
      substeps: 1,
      softening: 0,
      G: GRAVITATIONAL_CONSTANT,
    }),
    referencePeriod: period,
    expected: { g1Period: FIGURE_EIGHT_G1_PERIOD, zeroAngularMomentum: 0 },
    tolerances: {
      recurrence: 5e-2,
      minimumSeparation: 0.2,
      maximumRadius: 2,
      energy: 1e-7,
      angularMomentum: 1e-8,
      centerOfMass: 1e-10,
    },
  };
}

/** @returns {ReferenceFixture} */
export function createLowMomentumSymmetryFixture() {
  return {
    id: REFERENCE_FIXTURE_IDS.LOW_MOMENTUM_SYMMETRY,
    label: 'Four-body low-momentum symmetry',
    category: 'conservation-edge-case',
    source: 'Repository-authored D4-symmetric zero-velocity stress fixture',
    sourceUrl: 'repository://Barycenter/src/scenarios/reference.js',
    unitConversion: 'Constructed directly in AU, yr, M☉ with G = 4π².',
    bodies: [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
    ].map((position, index) => ({
      id: index + 1,
      name: `Symmetry ${index + 1}`,
      kind: /** @type {const} */ ('massive'),
      mass: 0.25,
      position,
      velocity: [0, 0, 0],
      radius: 0.02,
    })),
    config: normalizeSimConfig({
      integrator: INTEGRATORS.LEAPFROG,
      dt: 1e-4,
      substeps: 1,
      softening: 0.02,
      G: GRAVITATIONAL_CONSTANT,
    }),
    referencePeriod: null,
    expected: { zeroMomentum: 0, zeroAngularMomentum: 0 },
    tolerances: {
      angularMomentum: 1e-10,
      centerOfMass: 1e-10,
      maximumRadius: 2,
    },
  };
}

/** @returns {ReferenceFixture} */
export function createSoftenedCloseEncounterFixture() {
  return {
    id: REFERENCE_FIXTURE_IDS.SOFTENED_CLOSE_ENCOUNTER,
    label: 'Softened close encounter',
    category: 'finite-safety',
    source: 'Repository-authored near-overlap Plummer-softening stress fixture',
    sourceUrl: 'repository://Barycenter/src/scenarios/reference.js',
    unitConversion: 'Constructed directly in AU, yr, M☉ with G = 4π².',
    bodies: [
      {
        id: 1,
        name: 'Encounter A',
        kind: 'massive',
        mass: 1,
        position: [-5e-5, 0, 0],
        velocity: [0, -1e-4, 0],
        radius: 0.02,
      },
      {
        id: 2,
        name: 'Encounter B',
        kind: 'massive',
        mass: 1e-6,
        position: [5e-5, 0, 0],
        velocity: [0, 100, 0],
        radius: 0.01,
      },
    ],
    config: normalizeSimConfig({
      integrator: INTEGRATORS.LEAPFROG,
      dt: 1e-7,
      substeps: 1,
      softening: 1e-3,
      G: GRAVITATIONAL_CONSTANT,
    }),
    referencePeriod: null,
    expected: { softening: 1e-3, initialSeparation: 1e-4 },
    tolerances: {
      angularMomentum: 1e-8,
      centerOfMass: 1e-10,
      maximumRadius: 2,
    },
  };
}

/** @returns {ReferenceFixture[]} */
export function createReferenceFixtures() {
  return [
    createCircularBinaryFixture(),
    createEccentricBinaryFixture(),
    createPlanetaryMassRatioFixture(),
    createFigureEightFixture(),
    createLowMomentumSymmetryFixture(),
    createSoftenedCloseEncounterFixture(),
  ];
}

/** @param {string} id @returns {ReferenceFixture} */
export function getReferenceFixture(id) {
  const fixture = createReferenceFixtures().find((candidate) => candidate.id === id);
  if (!fixture) throw new ValidationError(`Unknown reference fixture: ${id}`);
  return fixture;
}
