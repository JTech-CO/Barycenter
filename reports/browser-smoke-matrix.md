# M7 browser smoke matrix

**Date**: 2026-07-19
**Release status**: physical-browser gate blocked by the local automation runtime

## Target matrix

| Browser family | Local availability | Physical smoke in this run | Status |
|---|---|---|---|
| Chrome latest | Chrome 150.0.7871.125 installed | Not started: in-app Browser sandbox fails before connection | Blocked |
| Edge latest | Edge 150.0.4078.83 installed | Not started: in-app Browser sandbox fails before connection | Blocked |
| Firefox latest | Not installed on the reference device | Not run | Pending external runner |
| Safari latest | Not available on Windows | Not run | Pending macOS runner |

The in-app Browser was attempted twice during the Product Beta audit and failed
before page startup with a Windows sandbox ACL helper error while applying
deny-read ACLs in this Unicode workspace. The failure is outside the
application and is reproducible before any Barycenter URL is loaded. M7 does
not substitute a different unapproved browser-control mechanism.

## Automated semantic smoke

The fast suite covers these release flows in jsdom:

- default preset load, run, pause, fixed step, reset, body select/edit, share,
  and hash restoration;
- Natural language request, review, apply, integration, and failure isolation;
- Canvas 2D unavailable fallback while CPU stepping, diagnostics, and CSV stay
  operational;
- user-triggered WebM adapter success and explicit unsupported-browser error;
- bounded trails/diagnostics, viewport-responsive DOM, and accessible command
  names; and
- runtime LCP-candidate and 50ms long-task observer adapters.

The static preview returned HTTP 200 for both the root and a direct fallback
path and served the deployment policy file. These checks verify application
semantics and artifact routing, but they are not evidence of browser paint,
layout, WebM codec availability, or LCP.

## Manual completion checklist

Run this matrix at desktop 1440×900, compact 1024×768, and mobile 390×844:

1. Load the default preset with no console error.
2. Restore a shared Scenario hash through direct URL entry.
3. Run, pause, single-step, reset, edit a body, and inspect conservation data.
4. Pan, zoom, fit, select, and measure on Canvas.
5. Export CSV and record a short WebM where MediaRecorder is supported.
6. Disable Canvas acceleration/features and confirm the CPU/diagnostic path.
7. Record final LCP and require no candidate above 2500ms after a clean load.
8. Confirm there are no unexpected tasks at or above 50ms in the core flow.

Core v1 must not be marked until the physical matrix and LCP item are
completed on supported browser runners.
