# M6 natural-language scenario evidence

**Date**: 2026-07-19
**Status**: implementation gate passed in provider-neutral reference mode
**External provider calls**: none

## Decision boundary

The user authorized M6 implementation but did not select a paid provider,
model, operating budget, or deployment target. M6 therefore ships with:

- a deterministic offline reference interpreter for representative binary,
  circumbinary-planet, planetary, Figure-8, and L4 tadpole requests;
- a provider-independent ScenarioDraft v1 JSON Schema, stable error envelope,
  and authoritative runtime validator;
- an optional separate Node proxy with a vendor-neutral structured-JSON
  adapter boundary; and
- no configured external provider, credential, or client dependency on the
  proxy.

This makes the static application and the complete request → review → apply
workflow testable without spending money or assuming deployment authority.
Activating a real provider remains an operational choice confined to the
server adapter and environment.

## Implemented boundary

1. The browser accepts at most 4096 UTF-8 prompt bytes.
2. With no public proxy URL, the offline interpreter returns a ScenarioDraft
   candidate. With a configured URL, the prompt is sent only in a POST JSON
   body with omitted credentials and no referrer.
3. Responses are capped at 131072 bytes and must use the versioned envelope.
4. ScenarioDraft validation requires explicit AU · yr · solar-mass · AU/yr
   units, strict known fields, unique int32 body IDs, finite positive massive
   masses, tracer mass zero, normalized G=4π², bounded phase-space values,
   valid frame references, and bounded simulation/render configuration.
5. The current runtime is not changed until the user selects **Apply validated
   draft**. Errors remain in the composer/console while presets, manual edits,
   and playback continue normally.
6. The optional proxy enforces route, origin, request size, hard timeout,
   provider response size, provider-envelope parsing, draft validation, and
   no-store responses. It never logs prompt or credential values.

## Gate evidence

| M6 gate | Result | Evidence |
|---|---|---|
| Representative plain text → validated, integrable candidate | Pass | Korean circumbinary request creates three bodies, integrates 100 fixed steps, and passes UI review/apply/step |
| Negative mass, NaN/Inf, missing fields, oversized payload, duplicate ID, units, unknown version rejected | Pass | ScenarioDraft contract matrix |
| API key absent from client bundle, logs, URL, and tracked values | Pass | pnpm security:scan; prompt transport test; proxy logger test |
| timeout, 5xx, malformed JSON/envelope do not affect core paths | Pass | client failure-injection tests, hard proxy timeout test, UI failure-isolation test |
| Provider format isolated | Pass | the only response extractor is packages/ai-proxy/src/provider-adapter.js, backed by fixtures |
| Static build works with no proxy | Pass | production build and proxy-free preview HTTP 200 |

## Reproduction

Reference runtime: Node 24.14.0, pnpm 11.9.0, Vite 7.3.6.

- pnpm test:ai
- pnpm verify
- pnpm exec vite preview --host 127.0.0.1 --port 4174 --strictPort

pnpm verify passed 23 test files / 97 tests, zero lint findings, browser and
Node strict checkJs, production build, and the secret-boundary scan. The build
artifact was 296.25 kB JavaScript / 93.57 kB gzip and 23.17 kB CSS / 4.79 kB
gzip. The proxy-free preview returned HTTP 200.

## Known limitation

No paid provider/model has been selected or contacted. The bundled structured
adapter defines the server-side request/response seam but cannot claim
vendor-specific production compatibility until the provider, model, budget,
and deployment are explicitly chosen. This does not affect the offline
workflow or any core simulation path.

The in-app browser visual audit remains unavailable in this Unicode Windows
workspace because its ACL helper fails before browser startup. Automated
jsdom interaction coverage passed; the blocker is visual-only and unchanged
from M5.
