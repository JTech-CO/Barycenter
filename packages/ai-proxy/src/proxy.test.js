import { once } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createScenarioDraft } from '../../../src/ai/contracts.js';
import { createCircularBinaryScenario } from '../../../src/scenarios/presets.js';
import { createAiProxyServer } from './proxy.js';

const servers = /** @type {import('node:http').Server[]} */ ([]);

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((resolve) => {
          server.close(() => resolve(undefined));
        }),
    ),
  );
});

/** @param {Parameters<typeof createAiProxyServer>[0]} options */
async function start(options) {
  const server = createAiProxyServer(options);
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test address.');
  return 'http://127.0.0.1:' + address.port;
}

describe('minimal AI proxy', () => {
  it('returns only a normalized draft envelope and logs no prompt', async () => {
    const draft = createScenarioDraft(createCircularBinaryScenario());
    const logger = vi.fn();
    const baseUrl = await start({
      adapter: {
        id: 'fixture',
        generate: vi.fn().mockResolvedValue(draft),
      },
      logger,
    });
    const response = await fetch(baseUrl + '/v1/scenario-drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contractVersion: 1,
        prompt: 'private scenario description',
      }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      contractVersion: 1,
      draft,
    });
    expect(logger).toHaveBeenCalledWith({
      event: 'request_succeeded',
      status: 200,
    });
    expect(JSON.stringify(logger.mock.calls)).not.toContain('private scenario');
  });

  it('rejects oversized input before the adapter', async () => {
    const generate = vi.fn();
    const baseUrl = await start({
      adapter: { id: 'fixture', generate },
      maximumRequestBytes: 128,
    });
    const response = await fetch(baseUrl + '/v1/scenario-drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contractVersion: 1, prompt: 'x'.repeat(512) }),
    });
    expect(response.status).toBe(413);
    expect(generate).not.toHaveBeenCalled();
  });

  it('turns provider timeout and invalid output into bounded errors', async () => {
    const timeoutBase = await start({
      adapter: {
        id: 'timeout',
        generate: () => new Promise(() => {}),
      },
      timeoutMs: 5,
    });
    const timeoutResponse = await fetch(
      timeoutBase + '/v1/scenario-drafts',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contractVersion: 1, prompt: 'binary' }),
      },
    );
    expect(timeoutResponse.status).toBe(504);

    const invalidBase = await start({
      adapter: {
        id: 'invalid',
        generate: vi.fn().mockResolvedValue({ version: 99 }),
      },
    });
    const invalidResponse = await fetch(
      invalidBase + '/v1/scenario-drafts',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contractVersion: 1, prompt: 'binary' }),
      },
    );
    expect(invalidResponse.status).toBe(502);
  });
});
