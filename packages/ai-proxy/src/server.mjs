import { createStructuredJsonProviderAdapter } from './provider-adapter.js';
import { createAiProxyServer } from './proxy.js';

/** @param {string} name */
function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error('Missing required server environment variable: ' + name);
  return value;
}

try {
  const adapter = createStructuredJsonProviderAdapter({
    endpoint: requiredEnvironment('BARYCENTER_AI_UPSTREAM_URL'),
    apiKey: requiredEnvironment('BARYCENTER_AI_API_KEY'),
    model: requiredEnvironment('BARYCENTER_AI_MODEL'),
  });
  const port = Number(process.env.BARYCENTER_AI_PORT ?? 8_787);
  const timeoutMs = Number(process.env.BARYCENTER_AI_TIMEOUT_MS ?? 10_000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('BARYCENTER_AI_PORT must be an integer from 1 to 65535.');
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('BARYCENTER_AI_TIMEOUT_MS must be finite and positive.');
  }
  const server = createAiProxyServer({
    adapter,
    allowedOrigin: process.env.BARYCENTER_AI_ALLOWED_ORIGIN,
    timeoutMs,
  });
  server.listen(port, '127.0.0.1', () => {
    process.stdout.write(
      'Barycenter AI proxy listening on 127.0.0.1:' +
        port +
        ' with adapter ' +
        adapter.id +
        '\n',
    );
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write('Barycenter AI proxy could not start: ' + message + '\n');
  process.exitCode = 1;
}
