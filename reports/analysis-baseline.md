# Barycenter M4 analysis baseline

- Release marker: **Analysis Alpha**
- Runtime: `v24.14.0`
- Canonical convention: Total mass=1, primary at (-μ,0), secondary at (1-μ,0), angular rate=1.
- Overall gate: **PASS**

## Fixed gates

| Gate | Observed | Limit | Status |
|---|---:|---:|:---:|
| L1 effective-potential gradient residual | 7.399636e-14 | ≤ 1.000000e-11 | PASS |
| L2 effective-potential gradient residual | 6.461498e-14 | ≤ 1.000000e-11 | PASS |
| L3 effective-potential gradient residual | 1.366528e-15 | ≤ 1.000000e-11 | PASS |
| L4 effective-potential gradient residual | 3.399627e-16 | ≤ 1.000000e-11 | PASS |
| L5 effective-potential gradient residual | 3.399627e-16 | ≤ 1.000000e-11 | PASS |
| L4 equilibrium verification maximum Jacobi error | 4.440892e-16 | ≤ 1.000000e-8 | PASS |
| L4 equilibrium verification recurrence/boundedness error | 2.095099e-9 | ≤ 1.000000e-5 | PASS |
| L4 tadpole verification maximum Jacobi error | 1.610743e-10 | ≤ 1.000000e-8 | PASS |
| L4 tadpole verification recurrence/boundedness error | 0.03813994 | ≤ 0.1000000 | PASS |

## Lagrange points

| Point | x | y | Residual | Iterations |
|---|---:|---:|---:|---:|
| L1 | 0.8480787 | 0 | 7.399636e-14 | 45 |
| L2 | 1.146765 | 0 | 6.461498e-14 | 46 |
| L3 | -1.004167 | 0 | 1.366528e-15 | 44 |
| L4 | 0.4900000 | 0.8660254 | 3.399627e-16 | 0 |
| L5 | 0.4900000 | -0.8660254 | 3.399627e-16 | 0 |

## Reproduce

- Analysis tests: `pnpm test:analysis`
- Regenerate this report: `pnpm report:analysis`
