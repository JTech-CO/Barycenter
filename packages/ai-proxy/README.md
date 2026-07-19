# Barycenter AI proxy

This optional Node service is the only component allowed to hold an external
provider credential. The static Barycenter build does not depend on it.

The browser sends a bounded POST request to `/v1/scenario-drafts`. The proxy
adds the provider credential, enforces request/response timeouts and byte
limits, validates the provider output against the shared ScenarioDraft v1
contract, and returns only the normalized draft.

Required server-only environment variables:

- `BARYCENTER_AI_UPSTREAM_URL`
- `BARYCENTER_AI_API_KEY`
- `BARYCENTER_AI_MODEL`

Optional variables are `BARYCENTER_AI_PORT` (default `8787`),
`BARYCENTER_AI_ALLOWED_ORIGIN`, and `BARYCENTER_AI_TIMEOUT_MS`.
Set the public browser variable `VITE_BARYCENTER_AI_PROXY_URL` to this
service's `/v1/scenario-drafts` route. Never place a provider credential in a
`VITE_*` variable.

The bundled `structured-json-v1` adapter is deliberately vendor-neutral
until a provider/model/cost decision is made. A vendor response-shape change
is isolated to `src/provider-adapter.js` and its fixtures.
