# Physics validation reports

M3 separates quick regression from the required long-horizon evidence:

- `pnpm test:physics` runs fixture, analytic-orbit, convergence-order, and short conservation checks.
- `pnpm test:physics:long` runs the 1,000-period leapfrog binary, 100-period Yoshida4 figure-8, and the report-only RK4 comparison.
- `pnpm report:physics` reruns the same fixed experiments and writes `physics-baseline.json` plus `physics-baseline.md`.

Run these commands with the repository-pinned Node 24 and pnpm versions. The report intentionally omits a generation timestamp so identical reruns produce a useful source diff. `accumulatedTime` and `clockRoundoff` retain the raw floating-point world clock while `duration = totalSteps × dt` records the exact nominal experiment span.

## Fixture provenance

- Circular, eccentric, and large mass-ratio binaries are barycentric Newtonian two-body constructions using Kepler's laws. The public reference is [NASA: Orbits and Kepler's Laws](https://science.nasa.gov/solar-system/orbits-and-keplers-laws/).
- The figure-8 existence result is Chenciner and Montgomery, [A remarkable periodic solution of the three-body problem in the case of equal masses](https://arxiv.org/abs/math/0011268). The numerical initial conditions credited to Carles Simó are transcribed from [Richard Montgomery's N-body page](https://people.ucsc.edu/~rmont/Nbdy/NbdyC1.html).
- The D4 low-momentum and softened close-encounter cases are repository-authored numerical edge fixtures; their definitions are versioned in `src/scenarios/reference.js`.

The published figure-8 data use `G=1`, equal unit masses, and period `6.32591398`. Barycenter keeps the positions as AU, multiplies velocities by `√(4π²)=2π`, and divides the reference period by `2π` to preserve the same trajectory at the public AU·yr·M☉ boundary.
