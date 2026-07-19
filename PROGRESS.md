# Barycenter progress

**Last updated**: 2026-07-19
**Current milestone**: M6 — 자연어 시나리오 (provider-neutral reference mode)
**Overall state**: M0–M6 implementation complete; M6 gate passed without an external provider; M7 is next

## Just completed

- Added the provider-independent ScenarioDraft v1 JSON Schema, stable error envelope, strict field/unit/physical validation, and bounded prompt/response contracts.
- Added a deterministic offline reference interpreter for binary, circumbinary planet, planetary, Figure-8, and L4 requests so static deployments retain the full request → review → apply path.
- Added a separate dependency-free Node proxy package with origin/request/response limits, a hard timeout, server-only credential handling, and an isolated structured-provider adapter.
- Added a Natural language composer that never mutates the runtime before explicit review/apply and leaves presets, manual editing, and playback usable after failures.
- Added provider timeout/5xx/malformed/oversized response injection, invalid physical draft matrices, adapter fixtures, prompt/log privacy checks, and UI success/failure integration coverage.
- Passed `pnpm verify`: zero lint findings, browser and proxy strict checkJs, 23 test files/97 tests, production build, and secret-boundary scan.
- Confirmed proxy-free production preview HTTP 200 and recorded evidence in `reports/m6-natural-language.md`.

## Next work

1. Profile physics, rendering, diagnostics, and bounded buffers for M7 on a recorded local reference environment.
2. Use the M7A evidence to decide whether the direct-force oracle needs a 3D Barnes–Hut path.
3. Complete release/browser/deploy gates that are possible locally and retain the existing visual-browser ACL blocker explicitly.

## Open questions

These do not block the Product Beta implementation.

- Which paid AI provider/model, if any, should replace the M6 vendor-neutral adapter? No provider is required for the offline/static workflow.
- Should collision behavior remain "no merge" for v1, or should optional inelastic merge enter after the core release?
- Should the current local Node/browser environment serve as the initial M7 reference machine, pending later physical browser smoke on the blocked in-app Browser runtime?
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
| M6 | Pass (provider-neutral reference mode) | 97 fast tests total; strict contract/failure isolation; secret scan; static preview HTTP 200; `reports/m6-natural-language.md` |
| M7 | Not started | Awaits local profiling and release hardening |

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
| 2026-07-19 | Implement M6 in provider-neutral reference mode and leave paid provider/model activation unconfigured. | The user authorized M6 implementation but did not authorize a vendor, budget, credential, or deployment; the static workflow and contract can still be completed without those assumptions. |
| 2026-07-19 | Use a dependency-free `node:http` proxy package with an isolated structured-JSON adapter instead of binding the client to a vendor SDK or Fastify. | The milestone requires a separate minimal bounded proxy; avoiding an added runtime framework keeps the optional service small while preserving timeout, size, origin, credential, and adapter boundaries. |

## Blockers

In-app Browser automation cannot start in this Unicode Windows workspace because its sandbox helper fails while applying deny-read ACLs. This blocks visual-only M5 viewport inspection, not build or runtime execution.
