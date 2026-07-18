# Barycenter progress

**Last updated**: 2026-07-19
**Current milestone**: M2 — 결정론적 수치 코어 (ready)
**Overall state**: M0–M1 complete; M2 implementation not started

## Just completed

- Completed M1 application scaffolding with React 19.2.7, Vite 7.3.6, Zustand 5.0.14, pnpm 11.9.0, and Node 24.14.0.
- Added ESLint 10 flat configuration with enforced `src/core` framework/DOM boundaries.
- Added strict JSDoc type checking, Vitest, production build, and aggregate `pnpm verify` scripts.
- Added normalized units, allocation-controlled Vec3 utilities, unit tests, and a minimal analysis-frame shell.
- Audited the technical whitepaper, design whitepaper, and the previous-agent-oriented harness.
- Converted durable repository guidance to Codex's `AGENTS.md` convention.
- Established the detailed M0–M7 implementation plan and release dependency path.
- Restored rotating-frame, CR3BP, and Lagrange-point work as an explicit M4 gate.
- Moved acceleration work behind measured performance evidence in M7; kept natural-language integration M6 optional.

## Next work

1. Execute M2-01/M2-02: define validated runtime SoA state and extend vector primitives.
2. Execute M2-03/M2-04: implement direct gravity plus leapfrog, Yoshida4, and comparison RK4.
3. Execute M2-05/M2-06: implement Kepler conversion and scale-aware diagnostics.
4. Execute M2-07: implement transactional world stepping, reset, snapshot, and safe stop.
5. Run the full M2 core gate and record results below.

## Open questions

These do not block M1–M3.

- Which AI provider/model, if any, should back optional M6? The current technical whitepaper names Anthropic Fable 5; provider choice is deferred until M6 entry.
- Should collision behavior remain "no merge" for v1, or should optional inelastic merge enter after the core release?
- Which reference machine and browser set will define the M7 performance budget?
- Is a GPU force path a product requirement, or only a contingency if Barnes–Hut misses the measured target?

## Gate results

| Milestone | Status | Evidence |
|---|---|---|
| M0 | Pass | `AGENTS.md`, `Barycenter_마일스톤.md`, Codex-aligned harness, this handoff |
| M1 | Pass | Node 24.14.0 + `pnpm verify`; 5 tests; core boundary negative lint gate; preview HTTP 200 |
| M2–M7 | Not started | Waiting on dependencies |

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

## Blockers

None.
