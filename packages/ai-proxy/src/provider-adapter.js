import {
  MAX_DRAFT_BYTES,
  SCENARIO_DRAFT_ERROR_CODES,
  SCENARIO_DRAFT_JSON_SCHEMA,
  ScenarioDraftError,
} from '../../../src/ai/contracts.js';

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param {Response} response */
async function readProviderResponse(response) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_DRAFT_BYTES) {
    throw new ScenarioDraftError(
      SCENARIO_DRAFT_ERROR_CODES.RESPONSE_TOO_LARGE,
      'provider',
      'Provider response exceeded the configured byte limit.',
      { status: response.status },
    );
  }
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_DRAFT_BYTES) {
    throw new ScenarioDraftError(
      SCENARIO_DRAFT_ERROR_CODES.RESPONSE_TOO_LARGE,
      'provider',
      'Provider response exceeded the configured byte limit.',
      { status: response.status },
    );
  }
  return text;
}

/**
 * The only provider-envelope parser. Vendor format changes belong here and in
 * adapter fixtures, never in the proxy route, client, runtime, or core.
 *
 * @param {unknown} payload
 */
export function extractScenarioDraftFromProvider(payload) {
  if (!isRecord(payload) || !isRecord(payload.output)) {
    throw new ScenarioDraftError(
      SCENARIO_DRAFT_ERROR_CODES.RESPONSE_INVALID,
      'provider',
      'Provider response did not contain the structured output envelope.',
    );
  }
  if (!Object.hasOwn(payload.output, 'scenarioDraft')) {
    throw new ScenarioDraftError(
      SCENARIO_DRAFT_ERROR_CODES.RESPONSE_INVALID,
      'provider',
      'Provider response did not contain scenarioDraft.',
    );
  }
  return payload.output.scenarioDraft;
}

/**
 * @param {{
 *   endpoint: string,
 *   apiKey: string,
 *   model: string,
 *   fetchImpl?: typeof fetch,
 * }} options
 */
export function createStructuredJsonProviderAdapter(options) {
  if (
    typeof options.endpoint !== 'string' ||
    options.endpoint.length === 0 ||
    typeof options.apiKey !== 'string' ||
    options.apiKey.length === 0 ||
    typeof options.model !== 'string' ||
    options.model.length === 0
  ) {
    throw new ScenarioDraftError(
      SCENARIO_DRAFT_ERROR_CODES.CONFIGURATION,
      'configuration',
      'Provider endpoint, model, and server credential are required.',
    );
  }
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  return {
    id: 'structured-json-v1',
    /**
     * @param {{prompt: string, signal: AbortSignal}} request
     */
    async generate(request) {
      let response;
      try {
        response = await fetchImpl(options.endpoint, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            authorization: 'Bearer ' + options.apiKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: options.model,
            input: request.prompt,
            responseFormat: {
              type: 'json_schema',
              name: 'barycenter_scenario_draft_v1',
              strict: true,
              schema: SCENARIO_DRAFT_JSON_SCHEMA,
            },
          }),
          signal: request.signal,
          redirect: 'error',
        });
      } catch (error) {
        if (request.signal.aborted) throw error;
        throw new ScenarioDraftError(
          SCENARIO_DRAFT_ERROR_CODES.PROVIDER,
          'provider',
          'Provider request failed before a response was received.',
          { retryable: true, cause: error },
        );
      }
      const text = await readProviderResponse(response);
      if (!response.ok) {
        throw new ScenarioDraftError(
          SCENARIO_DRAFT_ERROR_CODES.PROVIDER,
          'provider',
          'Provider failed with HTTP ' + response.status + '.',
          {
            retryable: response.status >= 500,
            status: response.status,
          },
        );
      }
      let payload;
      try {
        payload = JSON.parse(text);
      } catch (error) {
        throw new ScenarioDraftError(
          SCENARIO_DRAFT_ERROR_CODES.RESPONSE_INVALID,
          'provider',
          'Provider returned malformed JSON.',
          { status: response.status, cause: error },
        );
      }
      return extractScenarioDraftFromProvider(payload);
    },
  };
}
