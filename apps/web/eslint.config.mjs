// ESLint 9 flat config for the website. `npm run lint` (next lint) and
// `next build` both read it.
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'

const __dirname = dirname(fileURLToPath(import.meta.url))
const compat = new FlatCompat({ baseDirectory: __dirname })

const eslintConfig = [
  {
    ignores: ['.next/**', '.next-local/**', 'node_modules/**', 'next-env.d.ts', 'coverage/**', 'public/**'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Allow `_`-prefixed names for intentionally unused arguments and variables.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Tests and Jest setup use CommonJS mocks.
    files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**', 'jest.setup.ts', 'jest/**', 'jest.config.js', 'tailwind.config.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // Cypress/Chai assertions are expressions (`expect(x).to.exist`).
    files: ['cypress/**'],
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
]

export default eslintConfig
