# Barycenter progress

**Last updated**: 2026-07-19
**Current milestone**: M5 — 인터랙티브 해석 도구 (Product Beta)
**Overall state**: M0–M5 implementation complete; Product Beta automated gate passed; in-app visual audit is environment-blocked

## Just completed

- Added an accumulator runtime that owns the deterministic world, bounded trails/diagnostics, playback, fixed stepping, reset points, editing, and CSV snapshots.
- Added four validated presets plus a versioned, LZ-compressed, size- and compute-limited Scenario URL contract with deterministic restore.
- Built the Canvas 2D orbit view with AU axes, camera pan/zoom/fit, selection, measurement, velocity vectors, trails, rotating frames, zero-velocity contours, and L1–L5 overlays.
- Built the Product Beta desktop shell: title bar, ribbon, specification tree, Cartesian/Kepler property editor, conservation monitor, figure dock, console, and status bar.
- Added responsive 1024 px and sub-768 px viewing shells, keyboard commands, focus gates, accessible labels, CSV export, and user-triggered WebM capture.
- Added the representative preset→run→step→select→edit→reset→share→restore integration test and NumberField interaction gates.
- Passed `pnpm verify`: zero lint warnings, strict checkJs, 18 test files/73 tests, and production build.
- Re-ran the 3-test long-horizon physics suite and production preview HTTP 200 smoke.
- Recorded the environment-blocked in-app visual audit and remaining viewport checklist in `reports/product-beta-qa.md`.

## Next work

1. Complete the visual-only viewport checklist when the in-app browser can start without the Windows ACL failure.
2. Decide whether to enter optional M6 natural-language scenarios or proceed directly to M7 profiling and release hardening.
3. Select the M7 reference machine and supported browser matrix before setting performance budgets.

## Open questions

These do not block the Product Beta implementation.

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
| M3 | Pass | 50 fast tests + 3 long tests; all-fixture conservation; 1,000-period energy trend; 100-period figure-8 recurrence; deterministic report |
| M4 | Pass | 61 fast tests; 11 analysis gates; frame round-trip; L1–L5 residual; two bounded-Jacobi presets; deterministic Analysis Alpha report |
| M5 | Automated pass; visual audit environment-blocked | 73 fast tests; 3 long tests; build; HTTP 200; workflow restore gate; `reports/product-beta-qa.md` |
| M6–M7 | Not started | M6 optional; M7 awaits profiling targets |

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
| 2026-07-19 | Scale the Simó figure-8 from `G=1` to `G=4π²` by multiplying velocities by `2π` and dividing the period by `2π`. | Preserves the published trajectory while honoring the public AU·yr·M☉ core boundary. |
| 2026-07-19 | Keep fast physics regression separate from the required 1,000/100-period long suite. | Pull-request verification stays fast without weakening release evidence. |
| 2026-07-19 | Report nominal duration as `totalSteps × dt` and retain accumulated world time plus clock roundoff separately. | Prevents display-only floating accumulation from misreporting an exact fixed-step experiment span. |
| 2026-07-19 | Freeze M3 tolerances and mark the passing baseline Core Alpha. | Later UI and acceleration paths must remain numerically consistent with this committed evidence. |
| 2026-07-19 | Use the canonical CR3BP convention with total mass 1, primaries at `-μ` and `1-μ`, and angular rate 1. | Makes potential, Jacobi, zero-velocity, and Lagrange-point results directly comparable. |
| 2026-07-19 | Require bracketed L1–L3 solves to retain point, bracket, endpoint values, iteration count, and failure reason. | UI analysis must expose numerical failure instead of silently returning a misleading point. |
| 2026-07-19 | Validate CR3BP trajectories through the existing inertial Yoshida4 world with a massless tracer. | Honors the production symplectic contract and avoids promoting RK4 from its comparison-only role. |
| 2026-07-19 | Freeze M4 residual/Jacobi tolerances and mark the passing baseline Analysis Alpha. | M5 overlays and figures must use this committed coordinate and invariant definition. |
| 2026-07-19 | Keep deterministic world ownership in `SimulationRuntime` and expose only immutable-style snapshots/summaries to React and Zustand. | Physics completion cadence must remain independent of render cadence. |
| 2026-07-19 | Canonicalize signed zero and bound shared-scenario bodies, `dt`, substeps, trails, JSON, and hash lengths before runtime creation. | Shared URLs must reproduce byte-stably without enabling resource-exhaustion inputs. |
| 2026-07-19 | Keep Canvas/WebM browser APIs in adapters outside `src/core`. | Preserves the framework- and DOM-free numerical oracle. |
| 2026-07-19 | Mark the in-app visual audit environment-blocked after two browser-runtime ACL failures and retain a manual viewport checklist. | Automated product flow, numerical, build, and HTTP gates passed; the failure occurred before browser connection. |

## Blockers

In-app Browser automation cannot start in this Unicode Windows workspace because its sandbox helper fails while applying deny-read ACLs. This blocks visual-only M5 viewport inspection, not build or runtime execution.
