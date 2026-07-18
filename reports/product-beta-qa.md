# M5 Product Beta QA

**Date**: 2026-07-19
**Automated gate**: Pass
**In-app visual inspection**: Environment-blocked

## Verified evidence

- `pnpm verify`: pass
  - ESLint: pass with zero warnings
  - strict JSDoc/`checkJs`: pass
  - Vitest: 18 files, 73 tests passed
  - Vite production build: pass, 1,825 modules
  - production assets: 279.68 kB JS (88.99 kB gzip), 18.09 kB CSS (4.00 kB gzip)
- `pnpm test:physics:long`: 3 long-horizon tests passed.
- Production preview: `http://127.0.0.1:4173/` returned HTTP 200 and the root application shell.
- Static design gate: zero hard-coded Hex colors outside `tokens.css`; zero gradient or blur effects.

## Product flow coverage

The jsdom integration gate performs this representative flow through the rendered UI:

1. Load the Figure-8 preset.
2. Run and pause the runtime.
3. Advance one fixed physics step.
4. Select a body and edit its name.
5. Reset to the new deterministic edit point.
6. Generate a versioned, compressed scenario URL.
7. Unmount and restore the application from that URL.
8. Confirm the edited body, preset identity, and reset step are restored.

Additional gates cover accumulator behavior, deterministic runtime replay, CSV output, NumberField direct entry and pointer scrubbing, LZ round-trip identity, restored CPU trajectory identity, signed-zero canonicalization, malformed payload rejection, prototype-pollution isolation, URL size caps, body-count caps, and safe `dt`/substep ranges.

## Acceptance matrix

| M5 criterion | Result | Evidence |
|---|---|---|
| Preset → run/step → select/edit → reset → share/restore | Pass | `Workbench.test.jsx` |
| Canvas, figures, status and monitor consume one completed snapshot | Pass | Runtime external-store contract and UI integration tests |
| Deterministic URL restoration | Pass | Scenario schema and 500-step CPU replay tests |
| Conservation monitor matches core diagnostics | Pass | Runtime snapshot construction and diagnostics regression suite |
| Token-only component colors and prohibited visual effects | Pass | Static source scan |
| 1024 px and 768 px responsive transitions | Implemented; visual audit pending | CSS media gates and mobile control shell |
| Keyboard, labels, focus, non-color state text | Pass in DOM; visual focus audit pending | Accessible-role integration queries and stylesheet gate |
| Malformed/oversized/unsafe shared scenarios rejected before runtime load | Pass | Schema validation tests |

## Browser inspection limitation

The required in-app Browser workflow was attempted twice after the production preview returned HTTP 200. Its browser-control runtime exited before connecting with:

`windows sandbox failed: helper_unknown_error: apply deny-read ACLs`

This is the same host ACL limitation affecting existing-file patch helpers in this Unicode workspace. No alternate browser-control surface was substituted.

When the browser connection is available, complete these visual-only checks:

- 1440×900: title bar, ribbon, two left panels, canvas/monitor, figure dock, console, and status bar fit without horizontal scrolling.
- 1024×768: figure dock and console collapse while the inspector and graphics remain usable.
- 390×844: canvas, conservation monitor, and fixed four-button mobile controller remain visible without horizontal scrolling.
- Pointer pan, wheel zoom, fit, selection, measurement, velocity vectors, and CR3BP contour/L1–L5 overlays render correctly.
- Focus outlines remain visible and no content depends on color alone.
- User-triggered WebM start/stop works in a browser exposing `captureStream` and `MediaRecorder`.
