# Barycenter repository guidance

## Mission

Barycenter is a browser-based, deterministic N-body gravity sandbox and solar-system simulator. Physical correctness and reproducibility take precedence over visual completeness or performance claims.

## Read order

Before changing the repository:

1. Read `PROGRESS.md` for the active milestone, next task, open questions, and decision log.
2. Read the active milestone in `Barycenter_마일스톤.md`.
3. Read the invariants and stop rules in `Barycenter_하네스.md`.
4. Read the relevant sections of `Barycenter_기술백서.md` and, for UI work, `Barycenter_디자인백서.md`.

When documents disagree, use this precedence: harness invariants and measurable gates, milestone acceptance criteria, technical whitepaper, design whitepaper. Record any material resolution in `PROGRESS.md`.

## Architecture rules

- Keep `src/core/` framework-agnostic: no React, Zustand, DOM, Canvas, or browser-global imports.
- Keep the runtime world and large trajectory buffers in the simulation layer. Push only UI summaries and snapshots into Zustand.
- Store physical state in 3D even while the v1 renderer projects it to a 2D reference plane.
- Use normalized units AU, yr, and solar mass with `G = 4π²` at the public core boundary.
- Use fixed-step symplectic integration for production simulation. Keep RK4 isolated as a comparison and validation path.
- Treat CPU direct summation as the force oracle. Any Barnes–Hut or GPU path must pass parity gates before becoming selectable.
- Use the same softened potential in diagnostics as the softening law used by force evaluation.
- Do not apply closed-system conservation gates to worlds containing externally fixed bodies; mark those diagnostics as constrained.
- Preserve deterministic iteration order. Do not introduce randomness without an explicit, serialized seed and an approved scope change.

## Working agreement

- Work within the active milestone or an explicitly selected sub-slice. Do not hide incomplete gates by moving to a later milestone.
- Add or update tests with behavior changes. Never delete, weaken, or loosen a physics gate merely to make it pass.
- Run the narrowest relevant check during iteration and the milestone gate before declaring completion.
- Update `PROGRESS.md` whenever the active milestone, next task, gate result, decision, or blocker changes.
- Keep generated benchmark and validation artifacts small and reproducible; do not commit large transient outputs or secrets.
- Keep optional AI integration unable to block presets, manual editing, simulation, or static deployment.

## Verification contract

M1 establishes the executable scripts. Once present, the repository-wide gate is `pnpm verify`, which must cover lint, JSDoc type checking, tests, and production build. Physics validation and benchmark commands are defined separately in the milestone plan because long-horizon runs should not make the fast pull-request suite impractical.

M1 established the application scaffold and executable verification scripts. Use `PROGRESS.md` as the source for the active implementation milestone.
