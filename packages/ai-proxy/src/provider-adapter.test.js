import { describe, expect, it, vi } from 'vitest';
import { createCircularBinaryScenario } from '../../../src/scenarios/presets.js';
import { createScenarioDraft } from '../../../src/ai/contracts.js';
import {
  createStructuredJsonProviderAdapter,
  extractScenarioDraftFromProvider,
} from './provider-adapter.js';

describe('structured provider adapter boundary', () => {
  it('extracts the only supported provider fixture envelope', () => {
    const draft = createScenarioDraft(createCircularBinaryScenario());
    expect(
      extractScenarioDraftFromProvider({
        output: { scenarioDraft: draft },
        providerMetadata: { ignored: true },
      }),
    ).toEqual(draft);
    expect(() => extractScenarioDraftFromProvider({ result: draft })).toThrow(
      /structured output envelope/,
    );
  });

  it('keeps credential and provider format server-side', async () => {
    const draft = createScenarioDraft(createCircularBinaryScenario());
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ output: { scenarioDraft: draft } }),
        { status: 200 },
      ),
    );
    const adapter = createStructuredJsonProviderAdapter({
      endpoint: 'https://provider.example.test/generate',
      apiKey: 'server-only-test-credential',
      model: 'fixture-model',
      fetchImpl,
    });
    const controller = new AbortController();
    await expect(
      adapter.generate({ prompt: 'binary system', signal: controller.signal }),
    ).resolves.toEqual(draft);
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers.authorization).toBe(
      'Bearer server-only-test-credential',
    );
    expect(JSON.parse(init.body)).toMatchObject({
      model: 'fixture-model',
      input: 'binary system',
      responseFormat: {
        type: 'json_schema',
        name: 'barycenter_scenario_draft_v1',
        strict: true,
      },
    });
  });
});
