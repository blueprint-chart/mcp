import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import tseslint from 'typescript-eslint'

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  stylistic.configs['recommended-flat'],
  {
    languageOptions: {
      globals: {
        // Node.js globals
        process: 'readonly',
        Buffer: 'readonly',
        globalThis: 'readonly',
        console: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',

        // DOM-ish globals (jsdom is set up in the render module; node has these too)
        Element: 'readonly',
        SVGElement: 'readonly',
        SVGGraphicsElement: 'readonly',
        SVGTextContentElement: 'readonly',
        SVGTextElement: 'readonly',
        HTMLElement: 'readonly',
        DOMRect: 'readonly',
        getComputedStyle: 'readonly',
        requestAnimationFrame: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
      },
    },
    rules: {
      'curly': ['error', 'all'],
      '@stylistic/comma-dangle': ['error', 'always-multiline'],
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '.claude/**',
      '.claude-flow/**',
      '.swarm/**',
      '.worktrees/**',
      'docs/superpowers/**',
      'test/golden/__snapshots__/**',
      'bin/loader.mjs',
    ],
  },
]
