import {
  MAX_DRAFT_BYTES,
  SCENARIO_DRAFT_ERROR_CODES,
  ScenarioDraftError,
  asScenarioDraftError,
  validateScenarioDraft,
  validateScenarioPrompt,
} from './contracts.js';
import { interpretScenarioPromptLocally } from './local-interpreter.js';

export const DEFAULT_SCENARIO_REQUEST_TIMEOUT_MS = 8_000;

/** @param {Response} response @param {number} maximumBytes */
async function readBoundedResponse(response, maximumBytes) {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new ScenarioDraftError(
      SCENARIO_DRAFT_ERROR_CODES.RESPONSE_TOO_LARGE,
      'transport',
      'Scenario service response exceeds the configured size limit.',
    );
  }

  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maximumBytes) {
      throw new ScenarioDraftError(
        SCENARIO_DRAFT_ERROR_CODES.RESPONSE_TOO_LARGE,
        'transport',
        'Scenario service response exceeds the configured size limit.',
      );
    }
    return text;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new ScenarioDraftError(
          SCENARIO_DRAFT_ERROR_CODES.RESPONSE_TOO_LARGE,
          'transport',
          'Scenario service response exceeds the configured size limit.',
        );
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * @param {unknown} prompt
 * @param {{
 *   endpoint?: string,
 *   fetchImpl?: typeof fetch,
 *   timeoutMs?: number,
 * }} [options]
 */
export async function requestScenarioDraft(prompt, options = {}) {
  const normalizedPrompt = validateScenarioPrompt(prompt);
  const endpoint = options.endpoint?.trim() ?? '';
  if (endpoint.length === 0) {
    return {
      draft: interpretScenarioPromptLocally(normalizedPrompt),
      source: /** @type {'local-reference'} */ ('local-reference'),
    };
  }
  if (
    !Number.isFinite(options.timeoutMs ?? DEFAULT_SCENARIO_REQUEST_TIMEOUT_MS) ||
    (options.timeoutMs ?? DEFAULT_SCENARIO_REQUEST_TIMEOUT_MS) <= 0
  ) {
    throw new ScenarioDraftError(
      SCENARIO_DRAFT_ERROR_CODES.CONFIGURATION,
      'configuration',
      'Scenario request timeout must be finite and positive.',
    );
  }
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new ScenarioDraftError(
      SCENARIO_DRAFT_ERROR_CODES.CONFIGURATION,
      'configuration',
      'No fetch implementation is available for the configured proxy.',
    );
  }

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_SCENARIO_REQUEST_TIMEOUT_MS,
  );
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contractVersion: 1,
        prompt: normalizedPrompt,
      }),
      signal: controller.signal,
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
    });
    const text = await readBoundedResponse(response, MAX_DRAFT_BYTES);
    let payload;
    try {
      payload = text.length === 0 ? null : JSON.parse(text);
    } catch (error) {
      throw new ScenarioDraftError(
        SCENARIO_DRAFT_ERROR_CODES.RESPONSE_INVALID,
        'provider',
        'Scenario service returned malformed JSON.',
        { cause: error, status: response.status },
      );
    }
    if (!response.ok) {
      const message =
        payload &&
        typeof payload === 'object' &&
        'error' in payload &&
        payload.error &&
        typeof payload.error === 'object' &&
        'message' in payload.error &&
        typeof payload.error.message === 'string'
          ? payload.error.message
          : 'Scenario service failed with HTTP ' + response.status + '.';
      throw new ScenarioDraftError(
        SCENARIO_DRAFT_ERROR_CODES.PROVIDER,
        'provider',
        message,
        {
          retryable: response.status >= 500,
          status: response.status,
        },
      );
    }
    if (
      !payload ||
      typeof payload !== 'object' ||
      !('contractVersion' in payload) ||
      payload.contractVersion !== 1 ||
      !('draft' in payload)
    ) {
      throw new ScenarioDraftError(
        SCENARIO_DRAFT_ERROR_CODES.RESPONSE_INVALID,
        'provider',
        'Scenario service returned an unsupported response envelope.',
        { status: response.status },
      );
    }
    return {
      draft: validateScenarioDraft(payload.draft),
      source: /** @type {'proxy'} */ ('proxy'),
    };
  } catch (error) {
    if (
      controller.signal.aborted ||
      (error instanceof DOMException && error.name === 'AbortError')
    ) {
      throw new ScenarioDraftError(
        SCENARIO_DRAFT_ERROR_CODES.TIMEOUT,
        'transport',
        'Scenario service timed out without changing the current simulation.',
        { retryable: true, cause: error },
      );
    }
    throw asScenarioDraftError(error);
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
