import { createServer } from 'node:http';
import {
  MAX_PROMPT_BYTES,
  SCENARIO_DRAFT_ERROR_CODES,
  ScenarioDraftError,
  asScenarioDraftError,
  validateScenarioDraft,
  validateScenarioPrompt,
} from '../../../src/ai/contracts.js';

const DEFAULT_REQUEST_LIMIT = MAX_PROMPT_BYTES + 1_024;
const DEFAULT_TIMEOUT_MS = 10_000;

/** @param {import('node:http').ServerResponse} response @param {number} status @param {unknown} payload @param {string | null} allowedOrigin */
function sendJson(response, status, payload, allowedOrigin) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    ...(allowedOrigin ? { 'access-control-allow-origin': allowedOrigin } : {}),
    vary: 'origin',
  });
  response.end(body);
}

/** @param {import('node:http').IncomingMessage} request @param {number} maximumBytes */
async function readRequestJson(request, maximumBytes) {
  const declared = Number(request.headers['content-length']);
  if (Number.isFinite(declared) && declared > maximumBytes) {
    for await (const chunk of request) {
      // Drain the request without retaining an oversized body.
      void chunk;
    }
    throw new ScenarioDraftError(
      SCENARIO_DRAFT_ERROR_CODES.INPUT,
      'input',
      'Request payload exceeds the configured byte limit.',
    );
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maximumBytes) {
      throw new ScenarioDraftError(
        SCENARIO_DRAFT_ERROR_CODES.INPUT,
        'input',
        'Request payload exceeds the configured byte limit.',
      );
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    throw new ScenarioDraftError(
      SCENARIO_DRAFT_ERROR_CODES.INPUT,
      'input',
      'Request body must be valid JSON.',
      { cause: error },
    );
  }
}

/** @param {ScenarioDraftError} error */
function statusForError(error) {
  if (error.code === SCENARIO_DRAFT_ERROR_CODES.TIMEOUT) return 504;
  if (error.stage === 'provider' || error.stage === 'validation') return 502;
  if (error.stage === 'configuration') return 503;
  return error.message.includes('byte limit') ? 413 : 400;
}

/**
 * @param {{
 *   adapter: {id: string, generate: (request: {prompt: string, signal: AbortSignal}) => Promise<unknown>},
 *   allowedOrigin?: string,
 *   timeoutMs?: number,
 *   maximumRequestBytes?: number,
 *   logger?: (event: {event: string, code?: string, status?: number}) => void,
 * }} options
 */
export function createAiProxyServer(options) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maximumRequestBytes =
    options.maximumRequestBytes ?? DEFAULT_REQUEST_LIMIT;
  const allowedOrigin = options.allowedOrigin?.trim() || null;
  const logger = options.logger ?? (() => {});

  return createServer(async (request, response) => {
    const origin =
      typeof request.headers.origin === 'string' ? request.headers.origin : null;
    const responseOrigin =
      allowedOrigin === '*'
        ? '*'
        : origin && origin === allowedOrigin
          ? origin
          : null;

    if (request.method === 'OPTIONS' && request.url === '/v1/scenario-drafts') {
      if (origin && allowedOrigin && !responseOrigin) {
        sendJson(response, 403, { error: { message: 'Origin is not allowed.' } }, null);
        return;
      }
      response.writeHead(204, {
        ...(responseOrigin
          ? { 'access-control-allow-origin': responseOrigin }
          : {}),
        'access-control-allow-headers': 'content-type',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-max-age': '600',
        vary: 'origin',
      });
      response.end();
      return;
    }

    if (request.method === 'GET' && request.url === '/health') {
      sendJson(
        response,
        200,
        { status: 'ok', contractVersion: 1, adapter: options.adapter.id },
        responseOrigin,
      );
      return;
    }

    if (request.method !== 'POST' || request.url !== '/v1/scenario-drafts') {
      sendJson(response, 404, { error: { message: 'Route not found.' } }, responseOrigin);
      return;
    }
    if (origin && allowedOrigin && !responseOrigin) {
      sendJson(response, 403, { error: { message: 'Origin is not allowed.' } }, null);
      return;
    }

    const controller = new AbortController();
    let timeout = /** @type {ReturnType<typeof setTimeout> | null} */ (null);
    const timeoutFailure = /** @type {Promise<never>} */ (
      new Promise((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(
            new ScenarioDraftError(
              SCENARIO_DRAFT_ERROR_CODES.TIMEOUT,
              'transport',
              'Provider request timed out.',
              { retryable: true },
            ),
          );
        }, timeoutMs);
      })
    );
    try {
      const payload = await readRequestJson(request, maximumRequestBytes);
      if (
        !payload ||
        typeof payload !== 'object' ||
        !('contractVersion' in payload) ||
        payload.contractVersion !== 1 ||
        !('prompt' in payload)
      ) {
        throw new ScenarioDraftError(
          SCENARIO_DRAFT_ERROR_CODES.INPUT,
          'input',
          'Request must use contractVersion 1 and include prompt.',
        );
      }
      const prompt = validateScenarioPrompt(payload.prompt);
      const rawDraft = await Promise.race([
        options.adapter.generate({
          prompt,
          signal: controller.signal,
        }),
        timeoutFailure,
      ]);
      if (controller.signal.aborted) {
        throw new ScenarioDraftError(
          SCENARIO_DRAFT_ERROR_CODES.TIMEOUT,
          'transport',
          'Provider request timed out.',
          { retryable: true },
        );
      }
      const draft = validateScenarioDraft(rawDraft);
      logger({ event: 'request_succeeded', status: 200 });
      sendJson(
        response,
        200,
        { contractVersion: 1, draft },
        responseOrigin,
      );
    } catch (error) {
      const normalized = controller.signal.aborted
        ? new ScenarioDraftError(
            SCENARIO_DRAFT_ERROR_CODES.TIMEOUT,
            'transport',
            'Provider request timed out.',
            { retryable: true, cause: error },
          )
        : asScenarioDraftError(error, 'Scenario proxy rejected the response.');
      const status = statusForError(normalized);
      logger({ event: 'request_failed', code: normalized.code, status });
      if (!response.headersSent) {
        sendJson(response, status, normalized.toJSON(), responseOrigin);
      }
    } finally {
      if (timeout !== null) clearTimeout(timeout);
    }
  });
}
