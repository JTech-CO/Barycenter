# Barycenter progress

**Last updated**: 2026-07-19
**Current milestone**: M3 — 물리 정확성·장기 보존 검증 (ready)
**Overall state**: M0–M2 complete; M3 implementation not started

## Just completed

- Completed the deterministic Float64 SoA state contract with explicit massive/tracer roles, validation errors, cloning, and serialization.
- Added the symmetric direct O(N²) force oracle, massless tracer target behavior, softening, and the matching softened potential.
- Implemented leapfrog KDK and Yoshida4 production integrators plus an isolated RK4 comparison path.
- Added robust elliptic Kepler conversion with explicit true/mean anomaly semantics and high-eccentricity fallback solving.
- Added scale-aware energy, angular-momentum, momentum, and moving-barycenter diagnostics; fixed-body worlds are marked constrained.
- Added transactional world stepping, reset, snapshots, deterministic replay, and safe-stop rollback with preserved error context.
- Added a dedicated `pnpm test:core` gate. All 35 M2 tests and the full repository verification pass.
- Updated the application milestone indicator to M2 verified / M3 next.

## Next work

1. Add versioned reference fixtures for circular/eccentric binaries, a large mass-ratio system, figure-8, low-momentum symmetry, and softened close encounter.
2. Build fast and long-horizon validation runners with signed error sampling and reproducible reports.
3. Gate analytic period, 1,000-period leapfrog energy trend, angular momentum, moving COM, and dt convergence.
4. Gate figure-8 recurrence for at least 100 periods and document fixture provenance/unit scaling.
5. Record RK4 comparison evidence without making it a production integrator.

## Open questions

These do not block M3–M5.

- Which AI provider/model, if any, should back optional M6? The current technical whitepaper names Anthropic Fable 5; provider choice is deferred until M6 entry.
- Should collision behavior remain "no merge" for v1, or should optional inelastic merge enter after the core release?
- Which reference machine and browser set will define the M7 performance budget?
- Is a GPU force path a product requirement, or only a contingency if Barnes–Hut misses the measured target?

## Gate results

| Milestone | Status | Evidence |
|---|---|---|
| M0 | Pass | `AGENTS.md`, `Barycenter_마일스톤.md`, Codex-aligned harness, this handoff |
| M1 | Pass | Node 24.14.0 + `pnpm verify`; 5 tests; core boundary negative lint gate; preview HTTP 200 |
| M2 | Pass | Node 24.14.0 + `pnpm verify`; 35 core tests; force/potential parity; round-trip; convergence; deterministic replay; safe stop |
| M3–M7 | Not started | Waiting on dependencies |

## Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-07-19 | Use root `AGENTS.md` for durable Codex repository guidance. | Codex discovers repository instructions from `AGENTS.md`; no previous repository instruction file existed. |
| 2026-07-19 | Keep M1–M7 numbering and add M0 for planning/Codex conversion. | Preserves the original harness vocabulary while making the transition explicit. |
| 2026-07-19 | Core v1 path is M1 → M2 → M3 → M4 → M5 → M7. | Numerical truth and analysis features must precede product polish; M6 is optional. |
| 2026-07-19 | Put CR3BP, rotating frames, effective potential, and L1–L5 in M4. | They are core product promises but were missing from the original phase gates. |
| 2026-07-19 | Defer Barnes–Hut/GPU implementation to M7 after profiling. | Direct summation is the correctness oracle; acceleration should answer measured need. |
| 2026-07-19 | Use 3D runtime state and an octree for any Barnes–Hut path. | A 2D quadtree would not preserve force correctness for inclined 3D states. |
| 2026-07-19 | Scope v1 Kepler-element input to elliptic orbits (`0 ≤ e < 1`). | The specified eccentric-anomaly solver applies to elliptic motion; unbound motion remains possible via Cartesian state input. |
| 2026-07-19 | Pin M1 verification to Node 24.14.0, pnpm 11.9.0, Vite 7.3.6. | Vite 8.1.5/Rolldown repeatedly terminated natively on Windows under Node 25; the official Vite 7 path passed install, lint, strict checkJs, tests, build, and preview smoke. |
| 2026-07-19 | Make body gravity roles explicit: massive bodies source and receive gravity; zero-mass tracers receive but never source it. | Prevents an ambiguous `mass === 0` convention from contaminating forces and conserved quantities. |
| 2026-07-19 | Keep leapfrog/Yoshida4 as production fixed-step paths and RK4 as comparison only. | Preserves the long-horizon symplectic contract while retaining a validation baseline. |
| 2026-07-19 | Commit world state only after an entire outer step succeeds. | Safe-stop can restore the last valid phase-space state and retain the numerical cause. |

## Blockers

None.
