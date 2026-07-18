# Barycenter M3 physics baseline

- Release marker: **Core Alpha**
- Runtime: `v24.14.0`
- Units: AU · yr · M☉; `G = 39.47841760435743`
- Overall gate: **PASS**

## Reproduce

- Fast regression: `pnpm test:physics`
- Long horizon: `pnpm test:physics:long`
- Regenerate this report: `pnpm report:physics`

## Fixed gates

| Gate | Observed | Limit | Status |
|---|---:|---:|:---:|
| Circular period relative error | 5.019526e-5 | ≤ 1.000000e-4 | PASS |
| Eccentric period relative error | 1.333567e-8 | ≤ 1.000000e-4 | PASS |
| Mass-ratio period relative error | 1.274283e-5 | ≤ 1.000000e-4 | PASS |
| 1,000-period trend / energy envelope | 3.014890e-4 | ≤ 0.1000000 | PASS |
| Binary maximum angular-momentum error | 2.678799e-14 | ≤ 1.000000e-10 | PASS |
| Binary maximum expected-COM error | 0 | ≤ 1.000000e-10 | PASS |
| 100-period figure-8 recurrence error | 3.962799e-5 | ≤ 0.05000000 | PASS |
| Figure-8 minimum sampled separation | 0.6905265 | ≥ 0.2000000 | PASS |
| Figure-8 maximum origin radius | 1.081017 | ≤ 2.000000 | PASS |
| Figure-8 maximum absolute energy error | 9.522304e-10 | ≤ 1.000000e-7 | PASS |
| Figure-8 scale-normalized angular error | 3.436268e-14 | ≤ 1.000000e-8 | PASS |
| Figure-8 expected-COM error | 2.134425e-12 | ≤ 1.000000e-10 | PASS |

## Convergence

- Leapfrog observed orders: 1.982348, 1.995440
- Yoshida4 observed orders: 4.054534, 4.012348

## Integrator comparison (report only)

| Integrator | Peak-to-peak energy error | Trend/envelope | Final recurrence |
|---|---:|---:|---:|
| Leapfrog | 3.513415e-4 | 0.006750627 | 1.894374 |
| RK4 | 0.005270845 | 0.9999132 | 2.461831 |

RK4 is report-only. No CI assertion requires monotonic drift at a selected dt.

## Fixture provenance

| Fixture | Source | Unit conversion |
|---|---|---|
| Equal-mass circular binary | [Newtonian two-body circular solution and Kepler third law](https://science.nasa.gov/solar-system/orbits-and-keplers-laws/) | Constructed directly in AU, yr, M☉ with G = 4π². |
| Eccentric binary | [Barycentric elliptic Kepler solution initialized at periapsis](https://science.nasa.gov/solar-system/orbits-and-keplers-laws/) | Constructed directly in AU, yr, M☉ with G = 4π². |
| Large mass-ratio planetary orbit | [Barycentric elliptic Kepler construction with a 3×10⁻⁶ mass ratio](https://science.nasa.gov/solar-system/orbits-and-keplers-laws/) | Constructed directly in AU, yr, M☉ with G = 4π². |
| Chenciner–Montgomery figure-8 | [Carles Simó initial conditions; Chenciner–Montgomery orbit](https://people.ucsc.edu/~rmont/Nbdy/NbdyC1.html) | Published G=1 positions are treated as AU; velocities are multiplied by √(4π²)=2π and period divided by 2π. |
| Four-body low-momentum symmetry | [Repository-authored D4-symmetric zero-velocity stress fixture](repository://Barycenter/src/scenarios/reference.js) | Constructed directly in AU, yr, M☉ with G = 4π². |
| Softened close encounter | [Repository-authored near-overlap Plummer-softening stress fixture](repository://Barycenter/src/scenarios/reference.js) | Constructed directly in AU, yr, M☉ with G = 4π². |
