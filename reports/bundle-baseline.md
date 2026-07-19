# M7 production bundle baseline

**Generated**: 2026-07-19T07:48:47.542Z
**Build target**: es2022
**Budget result**: pass

## Assets

| File | Raw bytes | Gzip bytes |
|---|---:|---:|
| _headers | 234 | 184 |
| _redirects | 19 | 39 |
| assets/index-C8KHKKB0.js | 298582 | 94118 |
| assets/index-DNI_jyKd.css | 23443 | 4838 |
| index.html | 508 | 342 |

## Initial bundle budgets

| Budget | Actual | Maximum | Result |
|---|---:|---:|:---:|
| htmlBytes | 508 | 10000 | pass |
| javascriptGzipBytes | 94118 | 150000 | pass |
| cssGzipBytes | 4838 | 30000 | pass |
| totalGzipBytes | 99521 | 250000 | pass |

The bundle budget is a deterministic release guard, not an LCP measurement. Physical LCP must be observed in a supported browser and remains a separate release gate.
