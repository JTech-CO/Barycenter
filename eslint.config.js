import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

const coreRestrictedGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLCanvasElement',
  'requestAnimationFrame',
  'cancelAnimationFrame',
];

export default [
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'reports/generated/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['src/core/**/*.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react/*', 'zustand', 'zustand/*'],
              message: 'src/core must remain framework-agnostic.',
            },
            {
              group: [
                '../components/**',
                '../render/**',
                '../runtime/**',
                '../state/**',
              ],
              message: 'src/core cannot depend on UI or runtime adapters.',
            },
          ],
        },
      ],
      'no-restricted-globals': ['error', ...coreRestrictedGlobals],
    },
  },
];
