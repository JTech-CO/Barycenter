# M7 Core v1 release-candidate evidence

**Date**: 2026-07-19
**Status**: automated release gates passed; physical browser/LCP gate blocked
**Release label**: Product Beta retained; Core v1 withheld

## Reference environment

- Device: MSI Stealth 15 A13VF
- CPU: Intel Core i7-13620H, 10 cores / 16 logical processors
- Memory: 63.71 GiB
- OS: Windows 11 Pro 10.0.26200
- GPU: NVIDIA RTX 4060 Laptop GPU plus Intel UHD Graphics
- Power plan: Windows High performance
- Installed browsers: Chrome 150.0.7871.125, Edge 150.0.4078.83
- Benchmark viewport: 1440×900 at 1× dispatch scale
- Runtime: Node 24.14.0, pnpm 11.9.0, Vite 7.3.6

## M7 completion matrix

| Gate | Result | Evidence |
|---|---|---|
| N=100/500/2000 separated profile and hundreds-body 60fps target | Automated pass; browser paint pending | N=500 p95 frame estimate 7.2769ms / 137.42fps; N=2000 67.1555ms / 14.89fps in performance-baseline |
| Acceleration decision | Pass | Direct oracle retained; no Barnes-Hut or Worker because N=500 meets target; N=2000 is the future acceleration trigger |
| Bounded trail/diagnostic memory | Pass | Total trail capacity at most 32768 points for measured sizes, about 0.8MB typed-array storage; fixed diagnostic ring |
| Bundle and LCP | Bundle pass; LCP blocked | JS 94118B gzip, CSS 4838B gzip, total 99521B gzip; PerformanceObserver wired; no physical LCP sample |
| Fast and release suites | Pass | 28 files / 110 fast tests, 3 long physics tests, 11 analysis tests, benchmark, build, bundle, deploy, and secret gates |
| Supported browser smoke and CPU fallback | CPU fallback pass; matrix blocked | jsdom CPU/Canvas fallback and export coverage pass; physical matrix recorded in browser-smoke-matrix |
| Static deploy preview | Automated pass; media codec confirmation pending | root and direct entry HTTP 200; immutable assets, no-cache HTML, SPA fallback, URL restore, playback/monitor/export adapter tests |
| Limits, hardware, tolerances, options documented | Pass | this report, performance/bundle baselines, physics/analysis baselines, M6 report, and PROGRESS |

## Performance decision

The direct O(N²) force path remains the sole oracle and production path.
N=500 remains comfortably inside the 16.67ms JavaScript frame budget on the
reference device after:

- capping total trail history to 32768 3D points across bodies;
- reducing per-body capacity automatically as N grows;
- batching each body trail into one Canvas stroke; and
- avoiding per-point transform allocations outside rotating frames.

N=2000 is not advertised as realtime. Its measured estimated p95 frame is
67.1555ms and is marked as a long task. A future high-density milestone may
introduce a deterministic 3D Barnes-Hut octree, but only with the parity and
conservation gates already specified in the milestone.

## Release automation

- pnpm verify runs lint, browser/proxy strict checkJs, 110 fast tests,
  production build, bundle budgets, static artifact validation, and secret
  boundaries.
- pnpm release:verify adds the 1000/100-period long physics suite, CR3BP
  analysis suite, and N=100/500/2000 performance assertions.
- GitHub Actions separates fast push/PR validation from scheduled/manual
  release validation and uploads the static build plus evidence artifacts.

## Known limitations

- Physical Chrome/Edge/Firefox/Safari smoke and final LCP are not available in
  this workspace because the in-app Browser sandbox fails before startup.
- Canvas dispatch is measured in Node; rasterization and compositor time are
  not included in the benchmark estimate.
- N=2000 is non-realtime on the reference device; Barnes-Hut/GPU are not
  included in Core v1.
- Shared/untrusted Scenario payloads remain capped at 128 bodies.
- Canvas 2D is the primary renderer. If unavailable, simulation, properties,
  diagnostics, and CSV continue, while the orbit plot displays a fallback.
- WebM depends on browser MediaRecorder and a supported video/webm codec.
- Collision merge remains out of scope; close encounters use softening.
- The optional external natural-language provider remains unselected and
  unconfigured; the offline M6 reference path remains available.

## Release conclusion

Implementation and all locally executable release gates are complete. The
repository remains Product Beta rather than claiming Core v1 because the
physical supported-browser matrix and the 2500ms LCP gate have no valid
measurement. No numerical, performance-harness, build, or static-deployment
failure remains.
