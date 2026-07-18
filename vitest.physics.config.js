import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.long.test.js'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
