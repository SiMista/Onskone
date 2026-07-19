// ESLint 9+ flat config for the Onskoné pnpm monorepo.
//
// Intent: a *correctness* guardrail (React hook mistakes, obvious JS/TS bugs),
// NOT a stylistic flood and NOT a mass refactor. The noisy stylistic
// typescript-eslint rules are downgraded to "warn" / "off" so the codebase
// lints GREEN on errors while still surfacing the findings.
//
// A single root config covers frontend + backend + shared. The plugins are
// installed at the workspace root so this file can resolve them.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  // ---- Ignores (nothing generated / vendored gets linted) ----
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/node_modules/**',
      'frontend/android/**',
      'frontend/ios/**',
      'backend/data/**',
      // Generated question decks (built from the xlsx, never hand-edited).
      'backend/src/data/questions_fr.json',
      'backend/src/data/questions_en.json',
      // Build/tooling config files & plain JS scripts are out of scope.
      '**/*.config.js',
      '**/*.config.ts',
      '**/*.config.mjs',
      '**/*.config.cjs',
      'scripts/**',
      'eslint.config.js',
    ],
  },

  // ---- Base JS + TS recommended (correctness-focused) ----
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // ---- Global downgrade of noisy / stylistic rules to keep ERRORS green ----
  // These are real signals worth seeing, but they must not fail the build.
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-inferrable-types': 'off',
      // Empty catch blocks are used intentionally (silent best-effort storage /
      // URL parsing). Allow empty catch, still flag other empty blocks.
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  // ---- Frontend (React) : hooks + fast-refresh guardrails ----
  {
    files: ['frontend/src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      // The whole point of the guardrail: a real rules-of-hooks violation is a bug.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // ---- Backend (Node ESM) ----
  {
    files: ['backend/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // ---- Shared (isomorphic) ----
  {
    files: ['shared/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },

  // ---- Test files : relax a couple of rules that fight test ergonomics ----
  {
    files: ['**/*.{test,spec}.{ts,tsx}', 'backend/tests/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
