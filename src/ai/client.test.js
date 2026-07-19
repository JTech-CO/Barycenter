import { describe, expect, it, vi } from 'vitest';
import { createCircularBinaryScenario } from '../scenarios/presets.js';
import {
  MAX_DRAFT_BYTES,
  SCENARIO_DRAFT_ERROR_CODES,
  createScenarioDraft,
} from './contracts.js';
import { requestScenarioDraft } from './client.js';

const endpoint = 'https://proxy.example.test/v1/scenario-drafts';

describe('optional ScenarioDraft client', () => {
  it('uses the offline reference path without fetch when no proxy is configured', async () => {
    const fetchImpl = vi.fn();
    const result = await requestScenarioDraft('figure-8 three body', {
      fetchImpl,
    });
    expect(result.source).toBe('local-reference');
    expect(result.draft.scenario.id).toBe('natural-figure-eight');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('posts prompt in a bounded JSON body and validates the proxy response', async () => {
    const draft = createScenarioDraft(createCircularBinaryScenario());
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ contractVersion: 1, draft }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const result = await requestScenarioDraft('a circular binary', {
      endpoint,
      fetchImpl,
    });
    expect(result.source).toBe('proxy');
    expect(result.draft).toEqual(draft);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(endpoint);
    expect(url).not.toContain('circular');
    expect(init.credentials).toBe('omit');
    expect(init.headers).toEqual({ 'content-type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({
      contractVersion: 1,
      prompt: 'a circular binary',
    });
  });

  it.each([
    [
      '5xx',
      () =>
        new Response(
          JSON.stringify({ error: { message: 'Provider unavailable.' } }),
          { status: 503 },
        ),
      SCENARIO_DRAFT_ERROR_CODES.PROVIDER,
    ],
    [
      'malformed JSON',
      () => new Response('{not-json', { status: 200 }),
      SCENARIO_DRAFT_ERROR_CODES.RESPONSE_INVALID,
    ],
    [
      'bad response envelope',
      () => new Response(JSON.stringify({ contractVersion: 2 }), { status: 200 }),
      SCENARIO_DRAFT_ERROR_CODES.RESPONSE_INVALID,
    ],
    [
      'oversized response',
      () =>
        new Response('ignored', {
          status: 200,
          headers: { 'content-length': String(MAX_DRAFT_BYTES + 1) },
        }),
      SCENARIO_DRAFT_ERROR_CODES.RESPONSE_TOO_LARGE,
    ],
  ])('isolates %s responses', async (_label, response, expectedCode) => {
    await expect(
      requestScenarioDraft('binary system', {
        endpoint,
        fetchImpl: vi.fn().mockResolvedValue(response()),
      }),
    ).rejects.toMatchObject({ code: expectedCode });
  });

  it('aborts a provider timeout with a retryable stable error', async () => {
    const fetchImpl = vi.fn(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );
    await expect(
      requestScenarioDraft('binary system', {
        endpoint,
        fetchImpl,
        timeoutMs: 5,
      }),
    ).rejects.toMatchObject({
      code: SCENARIO_DRAFT_ERROR_CODES.TIMEOUT,
      retryable: true,
    });
  });
});
