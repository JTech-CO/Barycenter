# M7 performance baseline

**Generated**: 2026-07-19T07:51:53.554Z
**Runtime**: v24.14.0
**Platform**: win32 10.0.26200 x64
**Device**: MSI Stealth 15 A13VF; Intel Core i7-13620H; 64 GiB
**CPU**: 13th Gen Intel(R) Core(TM) i7-13620H (16 logical)
**Memory**: 63.708145 GiB
**Browser reference**: Chrome 150.0.7871.125 and Edge 150.0.4078.83 installed; Canvas dispatch measured in Node
**Power mode**: Windows High performance
**Viewport**: 1440x900 @ 1x benchmark viewport

## Separated p95 costs

| N | force oracle | leapfrog | diagnostics | full runtime step | body snapshot | trail append | trail snapshot | render adapter | frame estimate | estimated fps | long task |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|:---:|
| 100 | 0.1941 ms | 0.2733 ms | 0.1987 ms | 0.2119 ms | 0.1844 ms | 0.0095 ms | 0.4788 ms | 0.9858 ms | 1.8704 ms | 534.644996 | no |
| 500 | 1.3524 ms | 2.7286 ms | 0.9053 ms | 4.3817 ms | 0.6454 ms | 0.003 ms | 0.5874 ms | 1.6594 ms | 7.2769 ms | 137.421155 | no |
| 2000 | 24.5166 ms | 41.5163 ms | 8.5468 ms | 57.8944 ms | 2.0585 ms | 0.0174 ms | 1.4905 ms | 5.6947 ms | 67.1555 ms | 14.890813 | yes |

The frame estimate sums independently sampled p95 JavaScript costs. The render adapter measures projection and Canvas command dispatch with a counting context; it excludes browser rasterization, compositor scheduling, and paint.

## Bounded history

| N | effective trail/body | total trail points | trail storage | trail snapshot | diagnostics storage |
|---:|---:|---:|---:|---:|---:|
| 100 | 327 | 32700 | 785200 B | 784800 B | 36864 B |
| 500 | 65 | 32500 | 782000 B | 780000 B | 36864 B |
| 2000 | 16 | 32000 | 776000 B | 768000 B | 36864 B |

## Acceleration decision

- Direct oracle retained: true
- Barnes-Hut introduced: false
- Worker introduced: false
- Target: N=500 estimated p95 frame 7.2769 ms (137.421155 fps)
- High density: N=2000 estimated p95 frame 67.1555 ms (14.890813 fps)
- Rationale: Direct CPU summation meets the Core v1 hundreds-body target on the reference device. Barnes-Hut parity risk is deferred; N=2000 is documented as non-realtime and is the trigger for a future 3D octree path.

## Reproduction

- pnpm benchmark
- pnpm report:performance

Performance results are machine-specific. The deterministic fixture, body order, units, softening, fixed step, sample counts, and trail budget are versioned; compare regressions on the same device and power mode.
